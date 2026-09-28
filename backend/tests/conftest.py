"""Test doubles. These replace the *external* services ONLY inside automated tests so the
suite runs offline. The production app never uses them; real Hindsight is verified manually
(see docs/DEMO.md)."""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.hindsight_service import HindsightUnavailable, MemoryHit, incident_id_from
from app.llm import LLMUnavailable
from app.main import create_app


class MemStore:
    def __init__(self, fail=False):
        self.docs, self.fail = {}, fail

    async def get(self, i):
        return self.docs.get(i)

    async def save(self, d):
        self.docs[d["id"]] = dict(d)

    async def list(self):
        return sorted(self.docs.values(), key=lambda d: d["occurred_at"])


class FakeHindsight:
    def __init__(self):
        self.retained, self.down, self.fail_retain = {}, False, False

    async def ping(self):
        return not self.down

    async def retain(self, *, content, document_id, context, timestamp=None, metadata=None):
        if self.down or self.fail_retain:
            raise HindsightUnavailable("down")
        self.retained[document_id] = content

    async def recall(self, query):
        if self.down:
            raise HindsightUnavailable("down")
        words = set(re.findall(r"[a-z]{4,}", query.lower()))
        scored = []
        for doc, text in self.retained.items():
            score = len(words & set(re.findall(r"[a-z]{4,}", text.lower())))
            if score >= 4:
                scored.append((score, MemoryHit(text=text, incident_id=incident_id_from(doc, None, text), document_id=doc)))
        return [h for _, h in sorted(scored, key=lambda x: -x[0])]

    async def reflect(self, query):
        if self.down:
            raise HindsightUnavailable("down")
        return f"Reflection over {len(self.retained)} retained incidents: {query}"


class FakeLLM:
    configured = True

    def __init__(self, fail=False):
        self.fail = fail

    async def recommend(self, incident, hits):
        if self.fail:
            raise LLMUnavailable("x")
        h = hits[0]
        return {"relevant": True, "historical_incident_id": h.incident_id, "similarity_context": "Same service and error",
                "probable_root_cause": "Possibly a connection leak from the new deployment",
                "failed_actions": ["Increasing API replicas"], "successful_actions": ["Rolling back deployment"],
                "historical_resolution": "Rollback deployment", "recommended_next_steps": ["Compare pool metrics before/after deploy", "Consider rollback if leak confirmed"],
                "confidence": 0.99, "evidence_basis": ["Incident 1042 had the same error after a deploy"],
                "validation_warning": "Validate against live telemetry before acting."}


@pytest.fixture
def env():
    hs, store = FakeHindsight(), MemStore()
    s = Settings(hindsight_api_url="https://x", hindsight_api_key="k", llm_api_key="k", llm_base_url="https://l", llm_model="m")
    app = create_app(s, hindsight=hs, llm=FakeLLM(), store=store)
    return TestClient(app), hs, store


INCIDENT_1087 = {"incident_id": "1087", "service": "Payment API", "severity": "SEV-2",
                 "error_message": "Connection pool exhausted", "symptoms": "Checkout requests time out under load",
                 "recent_change": "New Payment API deployment", "logs": "Database connection pool is at capacity"}
