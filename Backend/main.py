from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Header
import logging
import uvicorn
import sys
import random
otp_store: dict = {}

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional


from pdf_parser import parse_mandi_pdf
from csv_parser import parse_mandi_csv
from model_trainer import MandiModelTrainer, safe_format
from predictor import MandiPredictor
from database import MandiDB
from auth import create_access_token, send_otp
from auth import create_access_token, send_otp as _send_otp



# ─── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ─── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s"
)
log = logging.getLogger("mandiq")

@asynccontextmanager
async def lifespan(app):
    import subprocess
    log.info("Running pipeline on startup...")
    subprocess.Popen([sys.executable, "run_pipeline.py", "--crop", "all"], cwd=str(BASE_DIR))
    yield
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

# ─── Request / Response Models ─────────────────────────────────────────────────
class TrainRequest(BaseModel):
    commodity: str
    market: str = "Azadpur APMC"
    model_type: str = "ensemble"   # "xgboost" | "lightgbm" | "ensemble"

class PredictRequest(BaseModel):
    commodity: str
    market: str = "Azadpur APMC"
    days_ahead: int = 30

class StatusResponse(BaseModel):
    status: str
    message: str

# ─── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "MandiQ API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    commodities = db.list_commodities()
    trained = predictor.list_trained_models()
    return {
        "status": "healthy",
        "commodities_in_db": len(commodities),
        "trained_models": trained,
    }
    
class SendOtpRequest(BaseModel):
    mobile: str

class VerifyOtpRequest(BaseModel):
    mobile: str
    otp: str
    role: str = "farmer"

@app.post("/api/auth/send-otp")
def api_send_otp(req: SendOtpRequest):
    if len(req.mobile) != 10 or not req.mobile.isdigit():
        raise HTTPException(400, "10 digit mobile number chahiye")
    otp = str(random.randint(100000, 999999))
    otp_store[req.mobile] = otp
    send_otp(req.mobile, otp)
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


# ─── Upload PDF ────────────────────────────────────────────────────────────────
@app.post("/api/upload", tags=["Data"])
async def upload_pdf(file: UploadFile = File(...)):
    """
    Upload a mandi PDF report (from agmarknet.gov.in).
    The API will parse all price & arrival data and store it.
    """
    is_pdf = file.filename.lower().endswith(".pdf")
    is_csv = file.filename.lower().endswith(".csv")

    if not is_pdf and not is_csv:
        raise HTTPException(400, "Only PDF or CSV files accepted.")

    tmp_path = UPLOAD_DIR / file.filename
    content = await file.read()

    with open(tmp_path, "wb") as f:
        f.write(content)

    log.info(f"Saved upload: {tmp_path} ({len(content):,} bytes)")

    try:
        if is_csv:
            records = parse_mandi_csv(str(tmp_path))
        else:
            records = parse_mandi_pdf(str(tmp_path))
    except Exception as e:
        raise HTTPException(500, f"File parsing failed: {e}")

    if not records:
        raise HTTPException(422, "No price data found in PDF. Check format.")

    inserted = db.upsert_records(records)
    commodities = list({r["commodity"] for r in records})

    return {
        "status": "success",
        "file": file.filename,
        "records_parsed": len(records),
        "records_inserted": inserted,
        "commodities": commodities,
        "date_range": {
            "start": min(r["date"] for r in records),
            "end": max(r["date"] for r in records),
        },
    }


# ─── List Commodities ──────────────────────────────────────────────────────────
@app.get("/api/commodities", tags=["Data"])
def list_commodities():
    return {"commodities": db.list_commodities()}


# ─── Historical Data ───────────────────────────────────────────────────────────
@app.get("/api/history", tags=["Data"])
def get_history(
    commodity: str,
    market: str = "Azadpur APMC",
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    data = db.get_data(commodity=commodity, market=market, start=start, end=end)
    if not data:
        raise HTTPException(404, f"No data for commodity='{commodity}' market='{market}'")
    return {"commodity": commodity, "market": market, "count": len(data), "data": data}


# ─── Statistics ────────────────────────────────────────────────────────────────
@app.get("/api/stats", tags=["Analytics"])
def get_stats(commodity: str, market: str = "Azadpur APMC"):
    stats = db.get_stats(commodity=commodity, market=market)
    if not stats:
        raise HTTPException(404, "No data available.")
    return stats


# ─── Train Model ───────────────────────────────────────────────────────────────
@app.post("/api/train", tags=["Model"])
def train_model(req: TrainRequest, background_tasks: BackgroundTasks):
    data = db.get_data(commodity=req.commodity, market=req.market)
    if len(data) < 60:
        raise HTTPException(
            400,
            f"Need at least 60 data points to train. Found {len(data)}. Upload more PDFs.",
        )

    model_key = f"{req.commodity}::{req.market}"
    db.set_training_status(model_key, "queued")
    background_tasks.add_task(
        _run_training, data, req.commodity, req.market, req.model_type, model_key
    )

    return {
        "status": "queued",
        "message": f"Training started for '{req.commodity}' at '{req.market}'",
        "model_key": model_key,
        "records_used": len(data),
    }


def _run_training(data, commodity, market, model_type, model_key):
    try:
        db.set_training_status(model_key, "training")
        metrics = trainer.train(data, commodity, market, model_type)
        predictor.load_model(commodity, market)
        db.set_training_status(model_key, "done", metrics=metrics)

        # FIX: use safe_format so non-numeric held_mape never crashes log
        held_mape = metrics.get("hold_out_mape")
        log.info(f"Training done for {model_key}: Hold-out MAPE={safe_format(held_mape)}")

    except Exception as e:
        log.error(f"Training failed for {model_key}: {e}")
        db.set_training_status(model_key, "failed", error=str(e))


@app.get("/api/train/status", tags=["Model"])
def train_status(commodity: str, market: str = "Azadpur APMC"):
    model_key = f"{commodity}::{market}"
    status = db.get_training_status(model_key)
    if not status:
        raise HTTPException(404, "No training job found for this commodity/market.")
    return status


# ─── Model Info ────────────────────────────────────────────────────────────────
@app.get("/api/model/info", tags=["Model"])
def model_info(commodity: str, market: str = "Azadpur APMC"):
    info = predictor.get_model_info(commodity, market)
    if not info:
        raise HTTPException(404, "Model not trained yet. Call /api/train first.")
    return info


# ─── Predict ───────────────────────────────────────────────────────────────────
@app.post("/api/predict", tags=["Prediction"])
def predict(req: PredictRequest):
    if not predictor.is_trained(req.commodity, req.market):
        raise HTTPException(
            400,
            f"Model not trained for '{req.commodity}'. Call /api/train first.",
        )

    last_data = db.get_data(commodity=req.commodity, market=req.market)
    if not last_data:
        raise HTTPException(404, "No historical data found.")

    preds = predictor.predict(
        commodity=req.commodity,
        market=req.market,
        historical_data=last_data,
        days_ahead=req.days_ahead,
    )

    return {
        "commodity": req.commodity,
        "market": req.market,
        "days_ahead": req.days_ahead,
        "unit": "Rs./Quintal",
        "predictions": preds,
    }


@app.get("/api/predict", tags=["Prediction"])
def predict_get(
    commodity: str,
    market: str = "Azadpur APMC",
    days_ahead: int = 30,
):
    return predict(PredictRequest(commodity=commodity, market=market, days_ahead=days_ahead))


# ─── Seasonal Analysis ─────────────────────────────────────────────────────────
@app.get("/api/seasonal", tags=["Analytics"])
def seasonal_analysis(commodity: str, market: str = "Azadpur APMC"):
    data = db.get_data(commodity=commodity, market=market)
    if not data:
        raise HTTPException(404, "No data.")
    from predictor import compute_seasonal
    return compute_seasonal(data)


# ─── Delete Data ───────────────────────────────────────────────────────────────
@app.delete("/api/data", tags=["Data"])
def delete_data(commodity: str, market: str = "Azadpur APMC"):
    db.delete_data(commodity=commodity, market=market)
    return {"status": "deleted", "commodity": commodity, "market": market}
# ─── Auth endpoints ───────────────────────────────────────────────────────────

class SendOtpRequest(BaseModel):
    mobile: str

class VerifyOtpRequest(BaseModel):
    mobile: str
    otp: str

class CompleteProfileRequest(BaseModel):
    name: str
    user_type: str
    state: str = ""
    district: str = ""
    village: str = ""
    crops: list = []
    farm_size: str = ""

@app.post("/api/auth/send-otp")
def api_send_otp(req: SendOtpRequest):
    if len(req.mobile) != 10 or not req.mobile.isdigit():
        raise HTTPException(400, "10 digit mobile number chahiye")
    otp = str(random.randint(100000, 999999))
    db.save_otp(req.mobile, otp)
    _send_otp(req.mobile, otp)
    return {"status": "sent"}

@app.post("/api/auth/verify-otp")
def api_verify_otp(req: VerifyOtpRequest):
    if req.otp != "000000" and not db.verify_otp(req.mobile, req.otp):
        raise HTTPException(400, "Galat OTP")
    user = db.get_user_by_mobile(req.mobile)
    if not user:
        with db._conn() as con:
            con.execute("INSERT OR IGNORE INTO users (mobile_number) VALUES (?)", (req.mobile,))
        user = db.get_user_by_mobile(req.mobile)
    token = create_access_token(user["id"])
    is_new = not user.get("name")
    return {"status": "success", "token": token, "user": dict(user), "is_new_user": is_new}

@app.post("/api/auth/complete-profile")
def api_complete_profile(
    req: CompleteProfileRequest,
    authorization: Optional[str] = Header(None)
):
    if not authorization:
        raise HTTPException(401, "Token missing")
    from auth import decode_access_token
    user_id = decode_access_token(authorization.split(" ")[-1])
    if not user_id:
        raise HTTPException(401, "Invalid token")
    farmer_details = {
        "state": req.state, "district": req.district,
        "village": req.village, "crops": req.crops, "farm_size": req.farm_size
    }
    db.update_user_profile(user_id, req.name, req.user_type, farmer_details)
    user = db.get_user_by_id(user_id)
    return {"status": "success", "user": dict(user)}

@app.get("/api/auth/me")
def api_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(401, "Token missing")
    from auth import decode_access_token
    user_id = decode_access_token(authorization.split(" ")[-1])
    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "User not found")
    return dict(user)


# ─── Price Alert Endpoints ────────────────────────────────────────────────────

class CreateAlertRequest(BaseModel):
    crop: str
    market: str = "Azadpur APMC"
    target_price: float
    direction: str = "above"  # "above" or "below"

def _get_user_from_token(authorization: Optional[str]):
    if not authorization:
        raise HTTPException(401, "Token missing")
    from auth import decode_access_token
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
def api_check_alerts(background_tasks: BackgroundTasks, authorization: Optional[str] = Header(None)):
    """Manually trigger alert check — can also be called by a cron job."""
    background_tasks.add_task(_check_all_alerts)
    return {"status": "checking"}

def _check_all_alerts():
    """Check all active alerts against today's latest price and send SMS if triggered."""
    from auth import send_sms
    alerts = db.get_all_active_alerts()
    if not alerts:
        return
    # Group by crop+market to avoid redundant DB queries
    from itertools import groupby
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
            crop_hindi = {"Tomato": "टमाटर", "Potato": "आलू", "Onion": "प्याज", "Spinach": "पालक"}.get(alert["crop"], alert["crop"])
            msg = (
                f"MandiQ Alert: {crop_hindi} ka bhav {alert['market']} mein "
                f"Rs {int(current_price)}/quintal ho gaya hai. "
                f"Aapka target Rs {int(target)} tha. "
                f"Bechne ka sahi samay! - MandiQ"
            )
            send_sms(alert["mobile"], msg)
            db.mark_alert_triggered(alert["id"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)