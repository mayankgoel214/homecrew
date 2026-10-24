from fastapi.testclient import TestClient

from app import main, safety
from app.store import LocalCaseStore
from app import store as db


def tier(t, label="x", note="", sev=3, renter=True):
    return safety.classify(t, label, note, sev, renter)["tier"]


def test_tiers():
    assert tier("exposed_wiring") == "pro"  # never DIY, even for owners
    assert tier("exposed_wiring", renter=False) == "pro"
    assert tier("mold", sev=2) == "landlord"
    assert tier("mold", sev=2, renter=False) == "diy"
    assert tier("mold", sev=4, renter=False) == "pro"  # big mold needs a pro
    big = safety.classify("mold", "mold", "", 4, True)
    assert not any("scrub with detergent" in s for s in big["steps"])  # no DIY cleanup advice for big mold
    assert tier("no_heat_indicator", renter=False) == "diy"
    assert tier("other", label="crack in load-bearing wall", renter=False) == "pro"
    assert tier("exposed_wiring", label="sparking outlet") == "emergency"
    assert tier("water_damage", note="Old stain from a past flood.") == "landlord"  # not an emergency


def test_spoken_emergencies():
    for text, kind in [("I smell gas in the kitchen", "gas"), ("the CO alarm is going off", "co"),
                       ("there are sparks coming out", "fire"), ("the bathroom is flooding", "flood")]:
        assert safety.emergency_in(text).kind == kind
    assert safety.emergency_in("is this mold?") is None
    assert safety.emergency_in("the fireplace looks dirty") is None


def test_refusals():
    assert safety.refuse_reason("how do I replace the outlet") is not None
    assert safety.refuse_reason("can I relight the pilot light") is not None
    assert safety.refuse_reason("can I bleach this mold") is None


def test_ask_guardrails(tmp_path, monkeypatch):
    s = LocalCaseStore(tmp_path)
    monkeypatch.setattr(main, "store", s)
    monkeypatch.setattr(db, "store", s)
    calls = []
    monkeypatch.setattr(main, "generate_json", lambda p, *a, **k: (calls.append(p) or {"say": "Open a window and run the fan."}, "fake"))
    c = TestClient(main.app)
    cid = c.post("/cases").json()["id"]
    c.post(f"/cases/{cid}/call/start", json={"trade": "plumber", "renter": True})
    assert "Marco" in c.get(f"/cases/{cid}").json()["chat"][0]["text"]

    gas = c.post(f"/cases/{cid}/ask", json={"text": "I smell gas"}).json()
    assert gas["emergency"] == "gas" and not calls  # answered by rule, model never asked
    panel = c.post(f"/cases/{cid}/ask", json={"text": "how do I fix the breaker panel"}).json()
    assert panel["refused"] and not calls
    ok = c.post(f"/cases/{cid}/ask", json={"text": "the bathroom smells musty"}).json()
    assert ok["answer"] == "Open a window and run the fan." and "Marco" in calls[0]
    chat = c.get(f"/cases/{cid}").json()["chat"]
    assert any(m["kind"] == "emergency" for m in chat)
