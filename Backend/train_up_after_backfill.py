"""
train_up_after_backfill.py — backfill_up_data.py ke complete hone ka intezaar karo,
phir UP mandi models train karo.

Backfill captcha + rate-limit ki wajah se 10-20 minute le sakta hai, isliye fixed
sleep se kaam nahi chalta. Ye DB poll karta hai aur data aate hi train karta hai.
Data na aaye to training skip — nakli data pe train karne se behtar khaali rehna.

main.py startup pe isko background mein chalata hai.
"""

import os
import sys
import time
import logging
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import MandiDB

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s")
log = logging.getLogger("train_up_wait")

POLL_SECONDS = 30
MAX_WAIT_MINUTES = 20


def up_data_ready() -> bool:
    try:
        return bool(MandiDB().get_data(commodity="Tomato", market="Prayagraj APMC"))
    except Exception as e:
        log.warning(f"DB check fail: {e}")
        return False


def main() -> int:
    deadline = time.time() + MAX_WAIT_MINUTES * 60
    while time.time() < deadline:
        if up_data_ready():
            log.info("UP asli data mil gaya — training shuru")
            return subprocess.run(
                [sys.executable, "train_up_mandis.py"],
                cwd=os.path.dirname(os.path.abspath(__file__)),
            ).returncode
        time.sleep(POLL_SECONDS)

    log.warning(
        f"{MAX_WAIT_MINUTES} min mein UP data nahi aaya — training skip. "
        "backfill_up_data.py manually chala ke dekho."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
