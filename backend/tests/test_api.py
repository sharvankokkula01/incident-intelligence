from conftest import INCIDENT_1087


def test_health_safe_status(env):
    c, *_ = env
    r = c.get("/api/health").json()
    assert r == {"ok": True, "hindsight_configured": True, "llm_configured": True, "bank_id": "incident-intelligence"}
    assert "key" not in str(r).lower().replace("hindsight_configured", "")


def test_validation(env):
    c, *_ = env
    r = c.post("/api/incidents/investigate", json={"service": "", "severity": "SEV-9", "error_message": "", "symptoms": ""})
    assert r.status_code == 422
    fields = {e["field"] for e in r.json()["errors"]}
    assert {"service", "severity", "error_message", "symptoms"} <= fields


def test_no_memory_recall(env):
    c, _, store = env
    r = c.post("/api/incidents/investigate", json=INCIDENT_1087)
    assert r.status_code == 200
    inv = r.json()["investigation"]
    assert inv["historical_experience_found"] is False
    assert inv["message"] == "No relevant historical experience found."
    assert inv["recall"]["status"] == "empty"
    assert "1087" in store.docs


def test_hindsight_unavailable_investigate_not_stored(env):
    c, hs, store = env
    hs.down = True
    r = c.post("/api/incidents/investigate", json=INCIDENT_1087)
    assert r.status_code == 503
    assert store.docs == {}  # nothing stored before successful recall


def test_hindsight_unavailable_demo_load(env):
    c, hs, _ = env
    hs.down = True
    assert c.post("/api/demo/load").status_code == 503


def test_demo_load_idempotent(env):
    c, hs, _ = env
    assert c.post("/api/demo/load").json()["retained"] == 5
    second = c.post("/api/demo/load").json()
    assert second["retained"] == 0 and second["skipped_existing"] == 5
    assert len(hs.retained) == 5


def test_retain_failure_on_resolve(env):
    c, hs, store = env
    c.post("/api/demo/load")
    c.post("/api/incidents/investigate", json=INCIDENT_1087)
    hs.fail_retain = True
    r = c.post("/api/incidents/1087/resolve", json={"root_cause": "leak", "resolution": "rollback"})
    assert r.status_code == 503
    assert store.docs["1087"]["status"] == "active" and store.docs["1087"]["retain_status"] == "failed"


def test_resolve_flow(env):
    c, hs, _ = env
    c.post("/api/incidents/investigate", json=INCIDENT_1087)
    body = {"root_cause": "Connection leak", "failed_actions": ["Scale replicas"], "successful_actions": ["Rollback"], "resolution": "Rolled back"}
    r = c.post("/api/incidents/1087/resolve", json=body)
    assert r.status_code == 200 and r.json()["retain_status"] == "retained"
    assert "incident-1087" in hs.retained
    assert c.post("/api/incidents/1087/resolve", json=body).status_code == 409
    assert c.post("/api/incidents/nope/resolve", json=body).status_code == 404
