from fastapi.testclient import TestClient

from app import main, ratelimit


def test_sliding_window():
    w = ratelimit.SlidingWindow()
    assert w.hit("k", 2, 60) is None and w.hit("k", 2, 60) is None
    assert 0 < w.hit("k", 2, 60) <= 60
    assert w.hit("other", 2, 60) is None


def test_case_creation_is_limited_per_visitor(monkeypatch):
    monkeypatch.setitem(ratelimit.PER_VISITOR, "case", 2)
    client = TestClient(main.app)
    a = {"x-forwarded-for": "1.1.1.1, 34.228.157.24"}
    assert client.post("/cases", headers=a).status_code == 200
    assert client.post("/cases", headers=a).status_code == 200
    blocked = client.post("/cases", headers=a)
    assert blocked.status_code == 429 and "Try again" in blocked.json()["detail"]
    assert int(blocked.headers["retry-after"]) > 0
    # A different visitor behind the same proxy is unaffected.
    assert client.post("/cases", headers={"x-forwarded-for": "2.2.2.2, 34.228.157.24"}).status_code == 200


def test_global_cap(monkeypatch):
    monkeypatch.setattr(ratelimit, "GLOBAL_GEMMA_PER_HOUR", 1)
    check = ratelimit.rate_limit("lawyer")

    class Req:
        def __init__(self, ip):
            self.headers = {"x-forwarded-for": ip}
            self.client = None

    check(Req("3.3.3.3"))
    try:
        check(Req("4.4.4.4"))
        raise AssertionError("global cap should have blocked")
    except ratelimit.HTTPException as e:
        assert e.status_code == 429
