from conftest import INCIDENT_1087


def test_happy_path(env):
    c, hs, _ = env
    # Load demo -> RETAIN x5
    assert c.post("/api/demo/load").json()["retained"] == 5
    # Recall -> historical experience
    r = c.post("/api/incidents/investigate", json=INCIDENT_1087).json()["investigation"]
    assert r["historical_experience_found"] is True
    assert r["historical"]["incident_id"] in {"1042", "1043"}
    assert r["historical"]["failed_actions"] and r["historical"]["successful_actions"]
    assert r["historical"]["evidence"]
    assert r["recommendation"]["confidence_score"] <= 0.85  # never certain
    assert r["recommendation"]["validation_warning"]
    # Resolve -> RETAIN
    res = c.post("/api/incidents/1087/resolve", json={"root_cause": "Connection leak after deployment",
        "failed_actions": ["Increasing API replicas"], "successful_actions": ["Rolling back deployment"], "resolution": "Rollback"})
    assert res.json()["retain_status"] == "retained" and len(hs.retained) == 6
    # Reflect
    ref = c.post("/api/patterns/reflect").json()
    assert ref["source"] == "Hindsight REFLECT" and len(ref["reflections"]) == 4
    assert all(x["answer"] for x in ref["reflections"])
    d = c.get("/api/dashboard").json()
    assert d["resolved_incidents"] == 6 and {"service": "Payment API", "count": 3} in d["recurring_patterns"]
