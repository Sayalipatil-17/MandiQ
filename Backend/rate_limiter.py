import os
import time
import logging
import threading

log = logging.getLogger("mandiq.ratelimit")

# Load configuration from environment variables
AUTH_WINDOW = int(os.environ.get("RATE_LIMIT_AUTH_WINDOW_MIN", 5)) * 60  # default 5 minutes
AUTH_MAX = int(os.environ.get("RATE_LIMIT_AUTH_MAX_REQUESTS", 3))       # default 3 requests

PUBLIC_WINDOW = int(os.environ.get("RATE_LIMIT_PUBLIC_WINDOW_SEC", 60))  # default 60 seconds
PUBLIC_MAX = int(os.environ.get("RATE_LIMIT_PUBLIC_MAX_REQUESTS", 60))    # default 60 requests

AUTH_ACTION_WINDOW = int(os.environ.get("RATE_LIMIT_AUTH_ACTION_WINDOW_SEC", 60)) # default 60 seconds
AUTH_ACTION_MAX = int(os.environ.get("RATE_LIMIT_AUTH_ACTION_MAX_REQUESTS", 200))  # default 200 requests

class InMemoryRateLimiter:
    def __init__(self):
        # Maps client identifier -> list of request timestamps
        self.requests = {}
        # Maps (ip, mobile) -> { "consecutive_blocks": int, "blocked_until": float }
        self.auth_backoffs = {}
        self.lock = threading.Lock()

    def clean_old_requests(self, client_key: str, window: int, now: float):
        if client_key in self.requests:
            self.requests[client_key] = [t for t in self.requests[client_key] if now - t < window]
            if not self.requests[client_key]:
                del self.requests[client_key]

    def check_public_limit(self, ip: str) -> bool:
        return True

    def check_auth_action_limit(self, identifier: str) -> bool:
        return True

    def check_otp_limit(self, ip: str, mobile: str) -> tuple[bool, int]:
        return True, 0

    def reset_otp_backoff(self, ip: str, mobile: str):
        pass

# Singleton Limiter instance
limiter = InMemoryRateLimiter()
