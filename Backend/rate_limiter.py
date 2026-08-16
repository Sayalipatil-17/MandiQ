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
        now = time.time()
        key = f"pub:{ip}"
        with self.lock:
            self.clean_old_requests(key, PUBLIC_WINDOW, now)
            history = self.requests.get(key, [])
            if len(history) >= PUBLIC_MAX:
                return False
            self.requests.setdefault(key, []).append(now)
            return True

    def check_auth_action_limit(self, identifier: str) -> bool:
        now = time.time()
        key = f"action:{identifier}"
        with self.lock:
            self.clean_old_requests(key, AUTH_ACTION_WINDOW, now)
            history = self.requests.get(key, [])
            if len(history) >= AUTH_ACTION_MAX:
                return False
            self.requests.setdefault(key, []).append(now)
            return True

    def check_otp_limit(self, ip: str, mobile: str) -> tuple[bool, int]:
        """
        OTP rate limiting with per-IP + per-mobile checks,
        and exponential backoff on consecutive blockings.
        Returns: (allowed: bool, wait_seconds_left: int)
        """
        now = time.time()
        key_ip = f"otp_ip:{ip}"
        key_mobile = f"otp_mob:{mobile}"
        backoff_key = f"{ip}:{mobile}"

        with self.lock:
            # Check if currently blocked by backoff
            backoff_info = self.auth_backoffs.get(backoff_key)
            if backoff_info and now < backoff_info["blocked_until"]:
                wait_time = int(backoff_info["blocked_until"] - now)
                return False, max(1, wait_time)

            # Clean history
            self.clean_old_requests(key_ip, AUTH_WINDOW, now)
            self.clean_old_requests(key_mobile, AUTH_WINDOW, now)

            ip_history = self.requests.get(key_ip, [])
            mob_history = self.requests.get(key_mobile, [])

            if len(ip_history) >= AUTH_MAX or len(mob_history) >= AUTH_MAX:
                # Trigger/increment backoff block duration
                consecutive = backoff_info["consecutive_blocks"] + 1 if backoff_info else 1
                # Exponential backoff: starting at 60s, doubling each time, max 3600s (1 hour)
                block_duration = min(60 * (2 ** (consecutive - 1)), 3600)
                blocked_until = now + block_duration
                
                self.auth_backoffs[backoff_key] = {
                    "consecutive_blocks": consecutive,
                    "blocked_until": blocked_until
                }
                log.warning(f"OTP Rate limit reached. Blocked {backoff_key} for {block_duration}s (consecutive={consecutive})")
                return False, block_duration

            # Record requests
            self.requests.setdefault(key_ip, []).append(now)
            self.requests.setdefault(key_mobile, []).append(now)
            return True, 0

    def reset_otp_backoff(self, ip: str, mobile: str):
        backoff_key = f"{ip}:{mobile}"
        with self.lock:
            if backoff_key in self.auth_backoffs:
                del self.auth_backoffs[backoff_key]
                log.info(f"OTP Backoff reset for {backoff_key}")

# Singleton Limiter instance
limiter = InMemoryRateLimiter()
