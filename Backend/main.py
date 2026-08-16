from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Header, Request, Query, Path as FastAPIPath, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
import logging
import uvicorn
import sys
import random
import os
import glob
import time
import subprocess
from datetime import datetime, timedelta
from rate_limiter import limiter

from pdf_parser import parse_mandi_pdf
from csv_parser import parse_mandi_csv
from model_trainer import MandiModelTrainer, safe_format
from predictor import MandiPredictor
from database import MandiDB
from auth import create_access_token, send_otp as _send_otp, decode_access_token
from mandiq_cross_mandi import best_market_today, all_commodities
from apscheduler.schedulers.background import BackgroundScheduler
import pandas as pd
scheduler = BackgroundScheduler(timezone="Asia/Kolkata")

# ─── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("mandiq")

def _check_all_alerts():
    """Har 9AM aur 6PM: check karo kisi ka alert trigger hua ya nahi."""
    from auth import send_sms
    alerts = db.get_all_active_alerts()
    checked: dict = {}
    for alert in alerts:
        # Fetch user name for the SMS template
        user = db.get_user_by_id(alert["user_id"])
        user_name = user.get("name") if (user and user.get("name")) else "Kisan"
        import re
        clean_name = re.sub(r'[^a-zA-Z0-9]', '', user_name)
        cname_val = f"{clean_name}{alert['crop']}"

        key = f"{alert['crop']}|{alert['market']}"
        if key not in checked:
            records = db.get_data(alert["crop"], alert["market"])
            checked[key] = records[-1]["modal_price"] if records else None
        current_price = checked[key]
        if current_price is None:
            continue
        target = alert["target_price"]
        direction = alert.get("direction", "above")
        triggered = (direction == "above" and current_price >= target) or \
                    (direction == "below" and current_price <= target)
        if triggered:
            crop_name = {"Tomato": "Tamatar", "Potato": "Aloo", "Onion": "Pyaz", "Spinach": "Palak"}.get(alert["crop"], alert["crop"])
            msg = (f"MandiQ Alert! {crop_name} ka bhav {alert['market']} mein "
                   f"Rs {int(current_price)}/quintal ho gaya. "
                   f"Aapka target Rs {int(target)} tha. Bechne ka sahi samay! - MandiQ App")
            send_sms(alert["mobile"], msg, cname=cname_val, oid=int(target))
            db.mark_alert_triggered(alert["id"])
            log.info(f"Alert triggered & SMS sent: {alert['crop']} @ {alert['market']} = {current_price}")

def _daily_scrape():
    """Roz subah 6 baje: sirf aaj ka data scrape karo, train mat karo."""
    log.info("[SCHEDULER] Daily scrape starting...")
    import subprocess
    subprocess.Popen(
        [sys.executable, "daily_scrape.py"],
        cwd=str(BASE_DIR)
    )

def _weekly_train():
    """Har Sunday raat 2 baje: scrape + full retrain."""
    log.info("[SCHEDULER] Weekly train starting...")
    import subprocess
    subprocess.Popen(
        [sys.executable, "run_pipeline.py", "--crop", "all"],
        cwd=str(BASE_DIR)
    )

@asynccontextmanager
async def lifespan(app):
    # Daily scrape: har roz 6:00 AM IST
    scheduler.add_job(_daily_scrape, "cron", hour=6, minute=0, id="daily_scrape")
    # Weekly train: har Sunday 2:00 AM IST
    scheduler.add_job(_weekly_train, "cron", day_of_week="sun", hour=2, minute=0, id="weekly_train")
    # Alert check: har roz subah 9 AM aur shaam 6 PM IST
    scheduler.add_job(_check_all_alerts, "cron", hour="9,18", minute=0, id="alert_check")
    scheduler.start()
    log.info("Scheduler started: daily scrape at 6AM, weekly train every Sunday 2AM, alert check at 9AM & 6PM")

    # Startup pe check: agar model 1 din se purana hai ya hai hi nahi → train karo
    import time, glob
    models = glob.glob(str(BASE_DIR / "models" / "*.pkl"))
    if models:
        oldest = min(os.path.getmtime(m) for m in models)
        days_old = (time.time() - oldest) / 86400
    else:
        days_old = 999  # koi model nahi → zaroor train karo

    if days_old >= 1:
        log.info(f"Models {days_old:.1f} din purane hain — weekly training shuru...")
        subprocess.Popen([sys.executable, "run_pipeline.py", "--crop", "all"], cwd=str(BASE_DIR))
    else:
        log.info(f"Models {days_old:.1f} din purane hain — sirf scrape chalayenge")
        subprocess.Popen([sys.executable, "daily_scrape.py"], cwd=str(BASE_DIR))

    yield
    scheduler.shutdown(wait=False)

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="MandiQ API",
    description="Agricultural mandi price prediction backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for docs, openapi, or explicit OTP routes (OTP handled inside routes)
    path = request.url.path
    if path in ("/api/auth/send-otp", "/api/auth/verify-otp", "/docs", "/openapi.json", "/redoc", "/favicon.ico"):
        return await call_next(request)

    ip = request.client.host if request.client else "unknown"
    
    # Check if there is an Authorization header
    auth_header = request.headers.get("authorization")
    user_id = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[-1]
        from auth import decode_access_token
        try:
            user_id = decode_access_token(token)
        except Exception:
            pass

    if user_id is not None:
        # Authenticated action: loose limit per user_id
        if not limiter.check_auth_action_limit(str(user_id)):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many authenticated requests. Please slow down."}
            )
    else:
        # Public action: moderate limit per IP
        if not limiter.check_public_limit(ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down."}
            )

    return await call_next(request)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Something went wrong. Please check server logs."}
    )

# ─── Singletons ────────────────────────────────────────────────────────────────
db = MandiDB()
trainer = MandiModelTrainer()
predictor = MandiPredictor()

# ─── Request Models ─────────────────────────────────────────────────────────────
class SendOtpRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10, pattern=r"^\d{10}$")

class VerifyOtpRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=10, pattern=r"^\d{10}$")
    otp: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    role: Literal["farmer", "trader"] = "farmer"

class CompleteProfileRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-zA-Z\s.]+$")
    user_type: Literal["farmer", "trader"]
    state: str = Field("", max_length=100)
    district: str = Field("", max_length=100)
    village: str = Field("", max_length=100)
    crops: List[str] = Field(default_factory=list)
    farm_size: str = Field("", max_length=50)

class TrainRequest(BaseModel):
    commodity: str = Field(..., min_length=2, max_length=100)
    market: str = Field("Azadpur APMC", min_length=2, max_length=100)
    model_type: Literal["ensemble", "reversion"] = "ensemble"

class PredictRequest(BaseModel):
    commodity: str = Field(..., min_length=2, max_length=100)
    market: str = Field("Azadpur APMC", min_length=2, max_length=100)
    days_ahead: int = Field(30, ge=1, le=365)
    model: Literal["reversion", "ensemble"] = "reversion"

class CreateAlertRequest(BaseModel):
    crop: str = Field(..., min_length=2, max_length=100)
    market: str = Field("Azadpur APMC", min_length=2, max_length=100)
    target_price: float = Field(..., gt=0.0)
    direction: Literal["above", "below"] = "above"

class RatingRequest(BaseModel):
    stars: int = Field(..., ge=1, le=5)
    feedback: str = Field("", max_length=500)

class PredFeedbackRequest(BaseModel):
    crop: str = Field(..., min_length=2, max_length=100)
    market: str = Field(..., min_length=2, max_length=100)
    accurate: Literal["yes", "no"]
    comment: str = Field("", max_length=500)



# ─── Health ────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "MandiQ API", "version": "1.0.0"}

@app.get("/health", tags=["Health"])
def health():
    return {
        "status": "healthy",
        "commodities_in_db": len(db.list_commodities()),
        "trained_models": predictor.list_trained_models(),
    }


# ─── Auth ──────────────────────────────────────────────────────────────────────

@app.post("/api/auth/send-otp")
def api_send_otp(req: SendOtpRequest, request: Request):
    if len(req.mobile) != 10 or not req.mobile.isdigit():
        raise HTTPException(400, "10 digit mobile number chahiye")
    
    # Bypass sending SMS. Always mock OTP send success.
    return {"status": "sent"}

@app.post("/api/auth/verify-otp")
def api_verify_otp(req: VerifyOtpRequest, request: Request):
    # Fetch or create user immediately without verifying OTP
    user = db.get_user_by_mobile_number(req.mobile)
    is_new = False
    if not user:
        user = db.create_user(req.mobile)
        is_new = True
    else:
        # Check if they have not completed onboarding steps yet (missing name or user_type)
        if not user.get("name") or not user.get("user_type"):
            is_new = True
            
    token = create_access_token(user["id"])
    return {
        "status": "success",
        "token": token,
        "user": dict(user),
        "is_new_user": is_new
    }

@app.post("/api/auth/complete-profile")
def api_complete_profile(req: CompleteProfileRequest, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(401, "Token missing")
    user_id = decode_access_token(authorization.split(" ")[-1])
    if not user_id:
        raise HTTPException(401, "Invalid token")
        
    farmer_details = {
        "state": req.state,
        "district": req.district,
        "village": req.village,
        "crops": req.crops,
        "farm_size": req.farm_size
    }
    db.update_user_profile(user_id, req.name, req.user_type, farmer_details)
    return {"status": "success", "user": dict(db.get_user_by_id(user_id))}

@app.get("/api/auth/me")
def api_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(401, "Token missing")
    user_id = decode_access_token(authorization.split(" ")[-1])
    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return dict(user)


# ─── Data ──────────────────────────────────────────────────────────────────────
@app.post("/api/upload", tags=["Data"])
async def upload_pdf(file: UploadFile = File(...)):
    is_pdf = file.filename.lower().endswith(".pdf")
    is_csv = file.filename.lower().endswith(".csv")
    if not is_pdf and not is_csv:
        raise HTTPException(400, "Only PDF or CSV files accepted.")

    # 1. Enforce size limit
    max_size = int(os.environ.get("MAX_UPLOAD_SIZE", 10 * 1024 * 1024))  # Default 10MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(400, f"File is too large. Max allowed size is {max_size / (1024 * 1024):.1f}MB.")

    # 2. Validate MIME content signature (Magic bytes)
    if is_pdf and not content.startswith(b"%PDF"):
        raise HTTPException(400, "Invalid PDF file: Content signature does not match PDF format.")

    if is_csv:
        try:
            decoded = content.decode("utf-8")
            if not decoded.strip():
                raise HTTPException(400, "Invalid CSV file: File is empty.")
            lines = decoded.splitlines()
            first_line = lines[0] if lines else ""
            # Ensure it looks like a delimiter-separated value file
            if not any(delim in first_line for delim in (",", ";", "\t", "|")):
                raise HTTPException(400, "Invalid CSV file: No valid delimiter found in header line.")
        except UnicodeDecodeError:
            raise HTTPException(400, "Invalid CSV file: Binary files not allowed.")

    # 3. Sanitize filename to prevent Path Traversal
    import re
    import uuid
    raw_name = os.path.basename(file.filename)
    sanitized = re.sub(r"[^a-zA-Z0-9_.-]", "", raw_name)
    if not sanitized or sanitized in (".", ".."):
        # Fallback to random unique name
        ext = ".pdf" if is_pdf else ".csv"
        sanitized = f"upload_{uuid.uuid4().hex}{ext}"
    else:
        # Prepend a random UUID to avoid any overwriting of system or other users' files
        ext = ".pdf" if is_pdf else ".csv"
        # strip existing extension and force correct one
        base_name = sanitized.rsplit(".", 1)[0]
        sanitized = f"{base_name}_{uuid.uuid4().hex}{ext}"

    tmp_path = UPLOAD_DIR / sanitized

    # Write contents securely
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        records = parse_mandi_csv(str(tmp_path)) if is_csv else parse_mandi_pdf(str(tmp_path))
    except Exception as e:
        # Clean up the file on parsing failure
        if tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(500, f"File parsing failed: {e}")

    if not records:
        if tmp_path.exists():
            tmp_path.unlink()
        raise HTTPException(422, "No price data found. Check format.")

    inserted = db.upsert_records(records)
    return {
        "status": "success",
        "file": sanitized,
        "records_parsed": len(records),
        "records_inserted": inserted,
        "commodities": list({r["commodity"] for r in records}),
        "date_range": {"start": min(r["date"] for r in records), "end": max(r["date"] for r in records)},
    }

@app.get("/api/commodities", tags=["Data"])
def list_commodities():
    return {"commodities": db.list_commodities()}

@app.get("/api/history", tags=["Data"])
def get_history(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100),
    start: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
):
    data = db.get_data(commodity=commodity, market=market, start=start, end=end)
    if not data:
        raise HTTPException(404, f"No data for commodity='{commodity}' market='{market}'")
    return {"commodity": commodity, "market": market, "count": len(data), "data": data}

@app.get("/api/stats", tags=["Analytics"])
def get_stats(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100)
):
    stats = db.get_stats(commodity=commodity, market=market)
    if not stats:
        raise HTTPException(404, "No data available.")
    return stats

@app.delete("/api/data", tags=["Data"])
def delete_data(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100)
):
    db.delete_data(commodity=commodity, market=market)
    return {"status": "deleted", "commodity": commodity, "market": market}


# ─── Model ─────────────────────────────────────────────────────────────────────
@app.post("/api/train", tags=["Model"])
def train_model(req: TrainRequest, background_tasks: BackgroundTasks):
    data = db.get_data(commodity=req.commodity, market=req.market)
    if len(data) < 60:
        raise HTTPException(400, f"Need at least 60 data points. Found {len(data)}.")
    model_key = f"{req.commodity}::{req.market}"
    db.set_training_status(model_key, "queued")
    background_tasks.add_task(_run_training, data, req.commodity, req.market, req.model_type, model_key)
    return {"status": "queued", "model_key": model_key, "records_used": len(data)}

def _run_training(data, commodity, market, model_type, model_key):
    try:
        db.set_training_status(model_key, "training")
        metrics = trainer.train(data, commodity, market, model_type)
        predictor.load_model(commodity, market)
        db.set_training_status(model_key, "done", metrics=metrics)
        log.info(f"Training done: {model_key} | Hold-out MAPE={safe_format(metrics.get('hold_out_mape'))}")
    except Exception as e:
        log.error(f"Training failed for {model_key}: {e}")
        db.set_training_status(model_key, "failed", error=str(e))

@app.get("/api/train/status", tags=["Model"])
def train_status(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100)
):
    status = db.get_training_status(f"{commodity}::{market}")
    if not status:
        raise HTTPException(404, "No training job found.")
    return status

@app.get("/api/model/info", tags=["Model"])
def model_info(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100)
):
    info = predictor.get_model_info(commodity, market)
    if not info:
        raise HTTPException(404, "Model not trained yet.")
    return info


# ─── Predict ───────────────────────────────────────────────────────────────────
@app.post("/api/predict", tags=["Prediction"])
def predict(req: PredictRequest):
    if not predictor.is_trained(req.commodity, req.market):
        raise HTTPException(400, f"Model not trained for '{req.commodity}'.")
    last_data = db.get_data(commodity=req.commodity, market=req.market)
    if not last_data:
        raise HTTPException(404, "No historical data found.")

    preds = predictor.predict(
        commodity=req.commodity, market=req.market,
        historical_data=last_data, days_ahead=req.days_ahead, model=req.model,
    )

    if req.model == "reversion":
        if isinstance(preds, dict) and "error" in preds:
            raise HTTPException(400, preds["error"])
        tomorrow = preds[0] if (isinstance(preds, list) and preds) else {}
        return {"commodity": req.commodity, "market": req.market, "days_ahead": req.days_ahead,
                "unit": "Rs./Quintal", "model": "reversion", **tomorrow, "predictions": preds}

    return {"commodity": req.commodity, "market": req.market, "days_ahead": req.days_ahead,
            "unit": "Rs./Quintal", "model": "ensemble", "predictions": preds}

@app.get("/api/predict", tags=["Prediction"])
def predict_get(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100),
    days_ahead: int = Query(30, ge=1, le=365),
    model: Literal["reversion", "ensemble"] = "reversion"
):
    return predict(PredictRequest(commodity=commodity, market=market, days_ahead=days_ahead, model=model))

@app.get("/api/seasonal", tags=["Analytics"])
def seasonal_analysis(
    commodity: str = Query(..., min_length=2, max_length=100),
    market: str = Query("Azadpur APMC", min_length=2, max_length=100)
):
    data = db.get_data(commodity=commodity, market=market)
    if not data:
        raise HTTPException(404, "No data.")
    from predictor import compute_seasonal
    return compute_seasonal(data)


# ─── Schedule Status ───────────────────────────────────────────────────────────
@app.get("/api/schedule/status", tags=["Schedule"])
def schedule_status():
    """Frontend ko batao: aaj actual data hai ya sirf predictions."""
    import datetime
    today = datetime.date.today().isoformat()
    jobs = []
    for job in scheduler.get_jobs():
        next_run = job.next_run_time
        jobs.append({
            "id": job.id,
            "next_run": next_run.isoformat() if next_run else None,
        })

    # Check karo ki aaj ka actual data DB mein hai
    has_today_data = {}
    for crop in ["Tomato", "Potato", "Onion", "Spinach"]:
        records = db.get_data(commodity=crop, market="Azadpur APMC", start=today, end=today)
        has_today_data[crop] = len(records) > 0

    return {
        "today": today,
        "has_today_actual_data": has_today_data,
        "scheduled_jobs": jobs,
    }

@app.post("/api/schedule/run-daily", tags=["Schedule"])
def manual_daily_scrape(background_tasks: BackgroundTasks):
    """Manually aaj ka scrape trigger karo (testing ke liye)."""
    background_tasks.add_task(_daily_scrape)
    return {"status": "daily scrape triggered"}

@app.post("/api/schedule/run-weekly", tags=["Schedule"])
def manual_weekly_train(background_tasks: BackgroundTasks):
    """Manually weekly train trigger karo (testing ke liye)."""
    background_tasks.add_task(_weekly_train)
    return {"status": "weekly training triggered"}


# ─── Cross-Mandi ───────────────────────────────────────────────────────────────
@app.get("/api/best-market/{commodity}", tags=["Cross-Mandi"])
@app.get("/best-market/{commodity}", tags=["Cross-Mandi"])
def get_best_market(commodity: str = FastAPIPath(..., min_length=2, max_length=100)):
    records = db.get_commodity_data_all_markets(commodity)
    if not records:
        raise HTTPException(404, f"No cross-market data for '{commodity}'")
    df = pd.DataFrame(records)
    df["commodity"] = commodity
    return best_market_today(df)

@app.get("/api/best-markets", tags=["Cross-Mandi"])
@app.get("/best-markets", tags=["Cross-Mandi"])
def get_best_markets():
    records = db.get_all_price_records()
    if not records:
        raise HTTPException(404, "No cross-market data found")
    return all_commodities(pd.DataFrame(records))


# ─── Alerts ────────────────────────────────────────────────────────────────────
def _get_user_from_token(authorization: Optional[str]):
    if not authorization:
        raise HTTPException(401, "Token missing")
    user_id = decode_access_token(authorization.split(" ")[-1])
    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return user

@app.post("/api/alerts")
def api_create_alert(req: CreateAlertRequest, authorization: Optional[str] = Header(None)):
    user = _get_user_from_token(authorization)
    mobile = user.get("mobile") or user.get("mobile_number", "")
    alert_id = db.create_alert(user["id"], mobile, req.crop, req.market, req.target_price, req.direction)
    return {"status": "created", "alert_id": alert_id}

@app.get("/api/alerts")
def api_get_alerts(triggered: int = Query(0, ge=0, le=1), authorization: Optional[str] = Header(None)):
    user = _get_user_from_token(authorization)
    return db.get_alerts_by_status(user["id"], triggered)

@app.delete("/api/alerts/{alert_id}")
def api_delete_alert(alert_id: int, authorization: Optional[str] = Header(None)):
    user = _get_user_from_token(authorization)
    db.delete_alert(alert_id, user["id"])
    return {"status": "deleted"}

@app.post("/api/alerts/check")
def api_check_alerts(background_tasks: BackgroundTasks):
    background_tasks.add_task(_check_all_alerts)
    return {"status": "checking"}


# ─── Prediction Feedback ───────────────────────────────────────────────────────
@app.post("/api/prediction/feedback")
def api_prediction_feedback(req: PredFeedbackRequest, authorization: Optional[str] = Header(None)):
    if req.accurate not in ("yes", "no"):
        raise HTTPException(400, "accurate must be 'yes' or 'no'")
    user_id = None
    if authorization:
        user_id = decode_access_token(authorization.split(" ")[-1])
    db.save_prediction_feedback(user_id, req.crop, req.market, req.accurate, req.comment)
    return {"status": "saved"}


# ─── App Ratings ───────────────────────────────────────────────────────────────
@app.post("/api/rating")
def api_save_rating(req: RatingRequest, authorization: Optional[str] = Header(None)):
    if not (1 <= req.stars <= 5):
        raise HTTPException(400, "stars must be between 1 and 5")
    user_id = None
    if authorization:
        user_id = decode_access_token(authorization.split(" ")[-1])
    db.save_rating(user_id, req.stars, req.feedback)
    return {"status": "saved"}

@app.get("/api/rating/stats")
def api_rating_stats():
    return db.get_rating_stats()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
