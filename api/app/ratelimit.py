"""Per-visitor and global limits on the endpoints that spend Gemma calls or storage.

Visitors are identified by IP. Requests reach Cloud Run through the Vercel rewrite, so the
connecting address is Vercel's; the visitor's address is the first entry of X-Forwarded-For
(Vercel overwrites that header, so a browser can't spoof it). Someone calling Cloud Run directly
could fake it, which is why there is also a global cap that holds no matter who is asking.

Counters live in memory, per Cloud Run instance (max 3), so worst case a limit is 3x looser.
Good enough to stop spam from breaking the demo; not a billing control.
"""

import hashlib
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

WINDOW = 600  # seconds (10 minutes)
# Generous on purpose: everyone on campus wifi can share one public IP.
PER_VISITOR = {"case": 30, "upload": 120, "lawyer": 20, "advocate": 20, "tts": 300}
GLOBAL_GEMMA_PER_HOUR = 1200  # all visitors combined, per instance


class SlidingWindow:
    def __init__(self):
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: float) -> float | None:
        """Record a hit. Returns None if allowed, else seconds until the next one is allowed."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - window:
                hits.popleft()
            if len(hits) >= limit:
                return hits[0] + window - now
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = SlidingWindow()


def visitor_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    first = forwarded.split(",")[0].strip()
    return first or (request.client.host if request.client else "unknown")


def fingerprint(ip: str) -> str:
    """Short one-way tag for logs, so we never log raw IPs."""
    return hashlib.sha256(f"homecrew|{ip}".encode()).hexdigest()[:10]


def rate_limit(kind: str):
    """FastAPI dependency: Depends(rate_limit("upload"))."""

    def check(request: Request) -> None:
        ip = visitor_ip(request)
        wait = limiter.hit(f"{kind}:{ip}", PER_VISITOR[kind], WINDOW)
        if wait is None and kind not in ("case", "tts"):  # only Gemma calls count toward the global cap
            wait = limiter.hit("gemma:global", GLOBAL_GEMMA_PER_HOUR, 3600)
        if wait is not None:
            minutes = max(1, round(wait / 60))
            print(f"rate_limited kind={kind} visitor={fingerprint(ip)}")
            raise HTTPException(
                429,
                f"Slow down a little: too many requests from your connection. Try again in about "
                f"{minutes} minute{'s' if minutes != 1 else ''}.",
                headers={"Retry-After": str(int(wait) + 1)},
            )

    return check
