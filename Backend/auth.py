import jwt
import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, Depends
from pathlib import Path
from dotenv import load_dotenv
from database import MandiDB

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


def send_otp(mobile_number: str, otp: str) -> bool:
    """
    Modular OTP sending function. Sends generated OTP to user's mobile number
    using the Renflair SMS gateway.
    """
    import requests
    banner = f"""
============================================================
  📱 [MandiQ OTP SERVICE] Generated OTP for +91 {mobile_number}:
  👉  {otp}  👈
  [Expires in 5 minutes]
============================================================
"""
    print(banner, flush=True)

    api_key = os.environ.get("RENFLAIR_API_KEY", "c98c2dfd199126b3fb530c3a684b9070")
    url = f"https://sms.renflair.in/V1.php?API={api_key}&PHONE={mobile_number}&OTP={otp}"
    try:
        resp = requests.get(url, timeout=10)
        log.info(f"OTP SMS request sent for {mobile_number}. Response: {resp.text}")
        return resp.status_code == 200
    except Exception as e:
        log.error(f"Failed to send OTP SMS via Renflair: {e}")
        return False


def send_sms(mobile_number: str, message: str, cname: str = "Kisan", oid: int = 0) -> bool:
    """Send alert/general SMS via Renflair SMS gateway V3.php template."""
    import requests
    import urllib.parse
    api_key = os.environ.get("RENFLAIR_API_KEY", "c98c2dfd199126b3fb530c3a684b9070")
    
    # URL encode the parameters for safety
    encoded_cname = urllib.parse.quote(cname)
    url = f"https://sms.renflair.in/V3.php?API={api_key}&PHONE={mobile_number}&OID={oid}&CNAME={encoded_cname}"
    
    try:
        resp = requests.get(url, timeout=10)
        log.info(f"Alert SMS sent to {mobile_number} using V3.php. Response: {resp.text}")
        return resp.status_code == 200
    except Exception as e:
        log.error(f"Failed to send alert SMS via Renflair V3.php: {e}")
        return False
