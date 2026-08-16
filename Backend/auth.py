import jwt
import os
import random
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
from pathlib import Path
from dotenv import load_dotenv
from database import MandiDB

import firebase_admin
from firebase_admin import credentials, auth as firebase_auth

# Firebase Admin SDK initialize karo
BASE_DIR_FB = Path(__file__).resolve().parent
_fb_cred_path = BASE_DIR_FB / "firebase-service-account.json"
if not firebase_admin._apps and _fb_cred_path.exists():
    cred = credentials.Certificate(str(_fb_cred_path))
    firebase_admin.initialize_app(cred)


log = logging.getLogger("mandiq.auth")

# Load environment variables
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("CRITICAL SECURITY ERROR: JWT_SECRET_KEY is not defined in the environment!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode = {"user_id": user_id, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[int]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("user_id")
    except jwt.ExpiredSignatureError:
        log.warning("Token expired")
        return None
    except jwt.InvalidTokenError:
        log.warning("Invalid token")
        return None

def get_current_user_id(authorization: Optional[str] = Header(None)) -> int:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token missing")
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
        
    token = parts[1]
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id

def get_current_user(user_id: int = Depends(get_current_user_id)) -> Dict[str, Any]:
    db = MandiDB()
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User session not found")
    return user

def _get_api_key() -> str:
    return os.environ.get("FAST2SMS_API_KEY", "")

def send_otp(mobile_number: str, otp: str) -> bool:
    """Send OTP via 2Factor.in — no DLT needed, works immediately."""
    import requests

    api_key = os.environ.get("TWOFACTOR_API_KEY", "")
    if not api_key:
        print(f"\n{'='*50}\n  📱 OTP for +91 {mobile_number}: {otp}\n  [TWOFACTOR_API_KEY not set]\n{'='*50}\n")
        return False

    try:
        url = f"https://2factor.in/API/V1/{api_key}/SMS/{mobile_number}/{otp}"
        resp = requests.get(url, timeout=10)
        data = resp.json()
        log.info(f"2Factor response: {data}")
        if data.get("Status") == "Success":
            log.info(f"✓ OTP sent to +91 {mobile_number} via 2Factor")
            return True
        log.warning(f"2Factor failed: {data}")
    except Exception as e:
        log.error(f"2Factor exception: {e}")

    # Console fallback
    print(f"\n{'='*50}\n  📱 OTP for +91 {mobile_number}: {otp}\n  [SMS failed — use this]\n{'='*50}\n")
    return False


def send_sms(mobile_number: str, message: str) -> bool:
    """Send general SMS via Fast2SMS Quick SMS route (uses credits)."""
    import requests
    api_key = _get_api_key()
    if not api_key or api_key == "your_fast2sms_api_key_here":
        print(f"\n[SMS - NO API KEY] To {mobile_number}: {message}\n")
        return False
    try:
        resp = requests.post(
            "https://www.fast2sms.com/dev/bulkV2",
            headers={"authorization": api_key, "Content-Type": "application/json"},
            json={
                "route": "q",
                "message": message,
                "language": "english",
                "flash": 0,
                "numbers": mobile_number,
            },
            timeout=10,
        )
        data = resp.json()
        if data.get("return"):
            log.info(f"SMS sent to {mobile_number}")
            return True
        log.warning(f"Fast2SMS error: {data}")
        return False
    except Exception as e:
        log.error(f"SMS send failed: {e}")
        return False
