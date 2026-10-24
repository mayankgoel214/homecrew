import pytest

from app.ratelimit import limiter


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    limiter.reset()
    yield
