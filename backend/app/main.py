import asyncio
import json
import logging
import re
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings, load_settings
from .hindsight_service import HindsightService, HindsightUnavailable, MemoryHit
from .llm import LLMService, LLMUnavailable
from .models import IncidentIn, ResolveIn
from .store import MongoStore, StoreUnavailable

log = logging.getLogger("incident.api")
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
NO_MATCH = "No relevant historical experience found."
REFLECT_QUESTIONS = [
    "What failure patterns keep recurring?",
    "Which fixes repeatedly work?",
    "Which troubleshooting actions repeatedly fail?",
    "Which services show recurring incidents?",
]
MAX_CONFIDENCE = 0.85  # never claim certainty


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def retain_content(d: dict) -> str:
    """Structured narrative sent to Hindsight RETAIN for one resolved incident."""
    f = "; ".join(d["failed_actions"]) or "none recorded"
    s = "; ".join(d["successful_actions"]) or "none recorded"
    return (
        f"Incident {d['incident_id'] if 'incident_id' in d else d['id']} (resolved). Service: {d['service']}. "
        f"Severity: {d['severity']}.\nError: {d['error_message']}\nSymptoms: {d['symptoms']}\n"
        f"Recent change: {d.get('recent_change') or 'none recorded'}\n"
        f"Probable root cause: {d['root_cause']}\n"
        f"Failed actions (did NOT fix it): {f}\nSuccessful actions (fixed it): {s}\n"
        f"Resolution: {d['resolution']}"
    )


def recall_query(inc: dict) -> str:
    parts = [f"{inc['service']} {inc['severity']} incident: {inc['error_message']}",
             f"Symptoms: {inc['symptoms']}"]
    if inc.get("recent_change"):
        parts.append(f"Recent change: {inc['recent_change']}")
    if inc.get("logs"):
        parts.append(f"Logs: {inc['logs'][:800]}")
    return "\n".join(parts)


def _split(v: str) -> list[str]:
    return [x.strip() for x in re.split(r";", v) if x.strip() and x.strip().lower() != "none recorded"]


def heuristic_parse(text: str) -> dict:
    def grab(label: str) -> str:
        m = re.search(label + r"[^:\n]*:\s*(.+)", text)
        return m.group(1).strip().rstrip(".") if m else ""
    return {"failed": _split(grab("Failed actions")), "successful": _split(grab("Successful actions")),
            "root_cause": grab("Probable root cause"), "resolution": grab("Resolution")}


def confidence_label(score: float) -> str:
    return "low" if score < 0.4 else "medium" if score < 0.7 else "high"


def _strs(v) -> list[str]:
    return [str(x) for x in v] if isinstance(v, list) else []


async def build_investigation(inc: dict, hits: list[MemoryHit], llm: LLMService) -> dict:
    base = {"incident_id": inc["id"], "recall": {"status": "ok" if hits else "empty", "count": len(hits)},
            "historical_experience_found": False, "message": NO_MATCH, "historical": None,
            "recommendation": None, "llm_status": "skipped"}
    hits = [h for h in hits if h.incident_id != inc["id"]]
    if not hits:
        base["recall"] = {"status": "empty", "count": 0}
        return base
    ids = Counter(h.incident_id for h in hits if h.incident_id)
    primary = ids.most_common(1)[0][0] if ids else None
    evidence_hits = [h for h in hits if h.incident_id == primary] if primary else hits
    evidence_hits += [h for h in hits if h not in evidence_hits][:3]
    evidence = [{"text": h.text, "incident_id": h.incident_id, "type": h.type} for h in evidence_hits[:8]]
    parsed = heuristic_parse("\n".join(h.text for h in evidence_hits if h.incident_id == primary or not primary))
    hist = {"incident_id": primary, "context": "", "probable_root_cause": parsed["root_cause"],
            "failed_actions": parsed["failed"], "successful_actions": parsed["successful"],
            "resolution": parsed["resolution"], "evidence": evidence}
    base["recall"] = {"status": "ok", "count": len(hits)}
    try:
        out = await llm.recommend({k: inc[k] for k in ("id", "service", "severity", "error_message", "symptoms", "logs", "recent_change")}, hits)
    except LLMUnavailable:
        base.update(historical_experience_found=True, message="Historical memories were recalled, but the LLM is unavailable so no recommendation was synthesized. Review the evidence directly.",
                    historical=hist, llm_status="unavailable")
        return base
    if not out.get("relevant", True):
        base["llm_status"] = "ok"
        return base
    try:
        score = max(0.0, min(MAX_CONFIDENCE, float(out.get("confidence", 0.3))))
    except (TypeError, ValueError):
        score = 0.3
    hist.update(
        incident_id=out.get("historical_incident_id") or primary,
        context=str(out.get("similarity_context") or ""),
        probable_root_cause=str(out.get("probable_root_cause") or hist["probable_root_cause"]),
        failed_actions=_strs(out.get("failed_actions")) or hist["failed_actions"],
        successful_actions=_strs(out.get("successful_actions")) or hist["successful_actions"],
        resolution=str(out.get("historical_resolution") or hist["resolution"]))
    base.update(historical_experience_found=True, message="", historical=hist, llm_status="ok",
                recommendation={
                    "probable_root_cause": str(out.get("probable_root_cause") or "Unknown"),
                    "recommended_next_steps": _strs(out.get("recommended_next_steps")),
                    "confidence_score": round(score, 2), "confidence_label": confidence_label(score),
                    "evidence_basis": _strs(out.get("evidence_basis")),
                    "validation_warning": str(out.get("validation_warning") or
                                              "This is decision support based on past incidents. Validate against current telemetry before acting.")})
    return base


def public(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "_id"}


def create_app(settings: Optional[Settings] = None, hindsight=None, llm=None, store=None) -> FastAPI:
    settings = settings or load_settings()
    hindsight = hindsight or HindsightService(settings)
    llm = llm or LLMService(settings)
    store = store or MongoStore(settings.mongodb_uri, settings.mongodb_db)
    app = FastAPI(title="Incident Intelligence API")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(HindsightUnavailable)
    async def _h(_: Request, e):
        return JSONResponse(status_code=503, content={"detail": "Hindsight memory service is unavailable. Check configuration and try again."})

    @app.exception_handler(StoreUnavailable)
    async def _s(_: Request, e):
        return JSONResponse(status_code=503, content={"detail": "Metadata database is unavailable. Check MongoDB and try again."})

    @app.exception_handler(RequestValidationError)
    async def _v(_: Request, e: RequestValidationError):
        errs = [{"field": ".".join(str(p) for p in x["loc"][1:]), "message": x["msg"]} for x in e.errors()]
        return JSONResponse(status_code=422, content={"detail": "Validation failed.", "errors": errs})

    @app.exception_handler(Exception)
    async def _x(_: Request, e: Exception):
        log.exception("Unhandled error")
        return JSONResponse(status_code=500, content={"detail": "Unexpected server error."})

    @app.get("/api/health")
    async def health():
        return {"ok": True, "hindsight_configured": settings.hindsight_configured,
                "llm_configured": settings.llm_configured, "bank_id": settings.hindsight_bank_id}

    @app.get("/api/incidents")
    async def incidents():
        return {"incidents": [public(d) for d in await store.list()]}

    @app.get("/api/dashboard")
    async def dashboard():
        docs = await store.list()
        resolved = [d for d in docs if d["status"] == "resolved"]
        svc = Counter(d["service"] for d in resolved)
        reachable = await hindsight.ping() if settings.hindsight_configured else False
        return {
            "active_incidents": sum(d["status"] == "active" for d in docs),
            "resolved_incidents": len(resolved),
            "memory_experiences": sum(d.get("retain_status") == "retained" for d in docs),
            "recurring_patterns": [{"service": s, "count": c} for s, c in svc.items() if c >= 2],
            "recent_incidents": [public(d) for d in sorted(docs, key=lambda d: d["occurred_at"], reverse=True)[:5]],
            "hindsight": {"configured": settings.hindsight_configured, "reachable": reachable},
            "llm": {"configured": settings.llm_configured},
        }

    @app.post("/api/demo/load")
    async def load_demo():
        demo = json.loads((DATA_DIR / "demo_incidents.json").read_text())
        retained = skipped = 0
        for d in demo:
            existing = await store.get(d["incident_id"])
            if existing and existing.get("retain_status") == "retained":
                skipped += 1
                continue
            rec = {**d, "id": d["incident_id"], "root_cause": d["root_cause"]}
            await hindsight.retain(
                content=retain_content(rec), document_id=f"incident-{d['incident_id']}",
                context=f"Resolved production incident {d['incident_id']} on {d['service']}",
                timestamp=datetime.fromisoformat(d["occurred_at"].replace("Z", "+00:00")),
                metadata={"incident_id": d["incident_id"], "service": d["service"], "severity": d["severity"]})
            doc = {**{k: v for k, v in d.items() if k != "incident_id"}, "id": d["incident_id"], "logs": "",
                   "status": "resolved", "resolved_at": d["occurred_at"], "retain_status": "retained",
                   "demo": True, "investigation": None}
            await store.save(doc)
            retained += 1
        return {"retained": retained, "skipped_existing": skipped, "total": len(demo)}

    @app.post("/api/incidents/investigate")
    async def investigate(body: IncidentIn):
        inc = body.model_dump()
        inc["id"] = inc.pop("incident_id") or f"INC-{uuid.uuid4().hex[:6].upper()}"
        existing = await store.get(inc["id"])
        if existing:
            raise HTTPException(409, f"Incident {inc['id']} already exists.")
        hits = await hindsight.recall(recall_query(inc))  # raises 503 before anything is stored
        inv = await build_investigation(inc, hits, llm)
        doc = {**inc, "occurred_at": now(), "status": "active", "resolved_at": None, "root_cause": "",
               "failed_actions": [], "successful_actions": [], "resolution": "",
               "retain_status": "not_retained", "demo": False, "investigation": inv}
        await store.save(doc)
        return {"incident": public(doc), "investigation": inv}

    @app.post("/api/incidents/{incident_id}/resolve")
    async def resolve(incident_id: str, body: ResolveIn):
        doc = await store.get(incident_id)
        if not doc:
            raise HTTPException(404, "Incident not found.")
        if doc["status"] == "resolved" and doc.get("retain_status") == "retained":
            raise HTTPException(409, "Incident is already resolved and retained.")
        rec = {**doc, **body.model_dump()}
        try:
            await hindsight.retain(
                content=retain_content(rec), document_id=f"incident-{incident_id}",
                context=f"Resolved production incident {incident_id} on {doc['service']}",
                timestamp=datetime.now(timezone.utc),
                metadata={"incident_id": incident_id, "service": doc["service"], "severity": doc["severity"]})
        except HindsightUnavailable:
            doc["retain_status"] = "failed"
            await store.save(doc)
            raise
        doc.update(body.model_dump(), status="resolved", resolved_at=now(), retain_status="retained")
        await store.save(doc)
        return {"incident": public(doc), "retain_status": "retained"}

    @app.post("/api/patterns/reflect")
    async def reflect():
        results = await asyncio.gather(*[hindsight.reflect(q) for q in REFLECT_QUESTIONS], return_exceptions=True)
        if all(isinstance(r, Exception) for r in results):
            raise HindsightUnavailable("reflect failed")
        return {"source": "Hindsight REFLECT", "reflections": [
            {"question": q, "answer": None if isinstance(r, Exception) else r,
             "error": "Hindsight could not answer this question." if isinstance(r, Exception) else None}
            for q, r in zip(REFLECT_QUESTIONS, results)]}

    return app


app = create_app()
