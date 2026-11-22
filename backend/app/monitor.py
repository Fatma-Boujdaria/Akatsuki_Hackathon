"""In-memory counters for the admin "System" screen.

Requests, server errors, rejected readings and emails since the API started.
Enough for one server process; a production deployment would export these to
a real monitoring tool instead.
"""

import threading
import time
from collections import Counter, deque

STARTED_AT = time.time()
_lock = threading.Lock()
counters: Counter = Counter()
recent_errors: deque[str] = deque(maxlen=20)


def incr(name: str, n: int = 1) -> None:
    with _lock:
        counters[name] += n


def error(text: str) -> None:
    with _lock:
        recent_errors.appendleft(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {text}"[:300])


def get(name: str) -> int:
    return counters.get(name, 0)


def uptime_s() -> int:
    return int(time.time() - STARTED_AT)


def reset() -> None:
    with _lock:
        counters.clear()
        recent_errors.clear()
