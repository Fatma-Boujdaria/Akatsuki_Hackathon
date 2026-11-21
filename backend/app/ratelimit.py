"""Small in-memory rate limiter (sliding window).

Enough for a one-laptop prototype: counts requests per key over the last
minute. With several server processes, move this to Redis or the database.
"""

import threading
import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_s: float = 60.0) -> None:
        self.limit = limit
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Record one hit for `key`; False if it is over the limit."""
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > 10_000:  # forget idle keys so memory stays bounded
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window_s]:
                    del self._hits[k]
            hits = self._hits[key]
            while hits and now - hits[0] > self.window_s:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
