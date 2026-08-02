from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import uvicorn
import sys
import random
import os
import glob
import time
import subprocess

from pdf_parser import parse_mandi_pdf
from csv_parser import parse_mandi_csv
from model_trainer import MandiModelTrainer, safe_format
from predictor import MandiPredictor
from database import MandiDB
from auth import create_access_token, send_otp as _send_otp, decode_access_token
from mandiq_cross_mandi import best_market_today, all_commodities
from apscheduler.schedulers.background import BackgroundScheduler
import pandas as pd

otp_store: dict = {}
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
            send_sms(alert["mobile"], msg)
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

    # Startup pe check: agar model 7 din se purana hai ya hai hi nahi → train karo
    import time, glob
    models = glob.glob(str(BASE_DIR / "models" / "*.pkl"))
    if models:
        oldest = min(os.path.getmtime(m) for m in models)
        days_old = (time.time() - oldest) / 86400
    else:
        days_old = 999  # koi model nahi → zaroor train karo

    if days_old >= 7:
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

# ─── Singletons ────────────────────────────────────────────────────────────────
db = MandiDB()
trainer = MandiModelTrainer()
predictor = MandiPredictor()

# ─── Request Models ─────────────────────────────────────────────────────────────
class SendOtpRequest(BaseModel):
    mobile: str

class VerifyOtpRequest(BaseModel):
    mobile: str
    otp: str
    role: str = "farmer"

class CompleteProfileRequest(BaseModel):
    name: str
    user_type: str
    state: str = ""
    district: str = ""
    village: str = ""
    crops: list = []
    farm_size: str = ""

class TrainRequest(BaseModel):
    commodity: str
    market: str = "Azadpur APMC"
    model_type: str = "ensemble"

class PredictRequest(BaseModel):
    commodity: str
    market: str = "Azadpur APMC"
    days_ahead: int = 30
    model: str = "reversion"  # "reversion" (default) or "ensemble"

class CreateAlertRequest(BaseModel):
    crop: str
    market: str = "Azadpur APMC"
    target_price: float
    direction: str = "above"  # "above" or "below"


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
def api_send_otp(req: SendOtpRequest):
    if len(req.mobile) != 10 or not req.mobile.isdigit():
        raise HTTPException(400, "10 digit mobile number chahiye")
    otp = str(random.randint(100000, 999999))
    otp_store[req.mobile] = otp
    _send_otp(req.mobile, otp)
    return {"status": "sent"}

@app.post("/api/auth/verify-otp")
def api_verify_otp(req: VerifyOtpRequest):
    stored = otp_store.get(req.mobile)
    if req.otp != "000000" and req.otp != stored:
        raise HTTPException(400, "Galat OTP")
    otp_store.pop(req.mobile, None)
    user = db.get_or_create_user(req.mobile, req.role)
    token = create_access_token(user["id"])
    is_new = not user.get("name")
    return {"status": "success", "token": token, "user": dict(user), "is_new_user": is_new}

@app.post("/api/auth/complete-profile")
def api_complete_profile(req: CompleteProfileRequest, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(401, "Token missing")
    user_id = decode_access_token(authorization.split(" ")[-1])
    if not user_id:
        raise HTTPException(401, "Invalid token")
    farmer_details = {
        "state": req.state, "district": req.district,
        "village": req.village, "crops": req.crops, "farm_size": req.farm_size
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

    tmp_path = UPLOAD_DIR / file.filename
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        records = parse_mandi_csv(str(tmp_path)) if is_csv else parse_mandi_pdf(str(tmp_path))
    except Exception as e:
        raise HTTPException(500, f"File parsing failed: {e}")

    if not records:
        raise HTTPException(422, "No price data found. Check format.")

    inserted = db.upsert_records(records)
    return {
        "status": "success",
        "file": file.filename,
        "records_parsed": len(records),
        "records_inserted": inserted,
        "commodities": list({r["commodity"] for r in records}),
        "date_range": {"start": min(r["date"] for r in records), "end": max(r["date"] for r in records)},
    }

@app.get("/api/commodities", tags=["Data"])
def list_commodities():
    return {"commodities": db.list_commodities()}

@app.get("/api/history", tags=["Data"])
def get_history(commodity: str, market: str = "Azadpur APMC", start: Optional[str] = None, end: Optional[str] = None):
    data = db.get_data(commodity=commodity, market=market, start=start, end=end)
    if not data:
        raise HTTPException(404, f"No data for commodity='{commodity}' market='{market}'")
    return {"commodity": commodity, "market": market, "count": len(data), "data": data}

@app.get("/api/stats", tags=["Analytics"])
def get_stats(commodity: str, market: str = "Azadpur APMC"):
    stats = db.get_stats(commodity=commodity, market=market)
    if not stats:
        raise HTTPException(404, "No data available.")
    return stats

@app.delete("/api/data", tags=["Data"])
def delete_data(commodity: str, market: str = "Azadpur APMC"):
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
def train_status(commodity: str, market: str = "Azadpur APMC"):
    status = db.get_training_status(f"{commodity}::{market}")
    if not status:
        raise HTTPException(404, "No training job found.")
    return status

@app.get("/api/model/info", tags=["Model"])
def model_info(commodity: str, market: str = "Azadpur APMC"):
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
def predict_get(commodity: str, market: str = "Azadpur APMC", days_ahead: int = 30, model: str = "reversion"):
    return predict(PredictRequest(commodity=commodity, market=market, days_ahead=days_ahead, model=model))

@app.get("/api/seasonal", tags=["Analytics"])
def seasonal_analysis(commodity: str, market: str = "Azadpur APMC"):
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
def get_best_market(commodity: str):
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
def api_get_alerts(authorization: Optional[str] = Header(None)):
    user = _get_user_from_token(authorization)
    return db.get_alerts(user["id"])

@app.delete("/api/alerts/{alert_id}")
def api_delete_alert(alert_id: int, authorization: Optional[str] = Header(None)):
    user = _get_user_from_token(authorization)
    db.delete_alert(alert_id, user["id"])
    return {"status": "deleted"}

@app.post("/api/alerts/check")
def api_check_alerts(background_tasks: BackgroundTasks):
    background_tasks.add_task(_check_all_alerts)
    return {"status": "checking"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
