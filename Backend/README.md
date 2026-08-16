# MandiQ Backend 🌾

Agricultural mandi price prediction API — upload agmarknet PDFs, train ML models, get forecasts.

## Architecture

```
PDF Upload → Parser → SQLite DB → XGBoost + LightGBM Ensemble → REST API → React Frontend
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the server
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. Open API docs
open http://localhost:8000/docs
```

## Workflow

### Step 1: Upload PDF
```http
POST /api/upload
Content-Type: multipart/form-data
file: <your_agmarknet_pdf>
```
Supports PDFs from https://agmarknet.gov.in/alltypeofreports

### Step 2: Train Model
```http
POST /api/train
{
  "commodity": "Tomato",
  "market": "Azadpur APMC",
  "model_type": "ensemble"   // xgboost | lightgbm | ensemble
}
```
Training is async. Poll `/api/train/status` until status = "done".

### Step 3: Predict
```http
GET /api/predict?commodity=Tomato&days_ahead=30
```
Returns daily forecasts with confidence intervals.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + model inventory |
| POST | `/api/upload` | Upload PDF, parse & store data |
| GET | `/api/commodities` | List all commodities in DB |
| GET | `/api/history` | Historical price records |
| GET | `/api/stats` | Rich statistics & year-wise trends |
| POST | `/api/train` | Start model training (async) |
| GET | `/api/train/status` | Poll training progress |
| GET | `/api/model/info` | Model metrics + feature importance |
| GET/POST | `/api/predict` | Price forecast with CI |
| GET | `/api/seasonal` | Monthly seasonality patterns |
| DELETE | `/api/data` | Remove commodity data |

## Model Performance (Tomato, Azadpur APMC, 5 years)

| Metric | Value |
|--------|-------|
| Hold-out MAPE | **7.1%** |
| CV MAPE (5-fold) | **9.2%** |
| Hold-out MAE | Rs. 117/Quintal |
| Features used | 69 |
| Data points | 1,442 |

## Feature Engineering (69 features)

- **Calendar**: month, week, day-of-year, quarter, season (India), cyclic sin/cos encodings
- **Lag prices**: 1, 2, 3, 5, 7, 10, 14, 21, 28, 30-day lags
- **Rolling stats**: 7/14/30/60/90-day mean, std, min, max, range, CV
- **Momentum**: 1d/7d/30d price change %, trend ratios
- **Arrival qty**: lag + rolling + price×supply interaction
- **Year-over-year**: 365-day price change

## Frontend Integration

Copy `mandiq-api.ts` into your React project's `src/` folder:

```tsx
import { mandiApi } from '@/mandiq-api'

// Upload a PDF
await mandiApi.uploadPdf(file)

// Train model
await mandiApi.trainModel('Tomato')
await mandiApi.waitForTraining('Tomato', 'Azadpur APMC', (s) => console.log(s.status))

// Get 30-day forecast
const predictions = await mandiApi.predict('Tomato', 30)

// Historical data for chart
const history = await mandiApi.getHistory('Tomato')

// Seasonal analysis
const seasonal = await mandiApi.seasonal('Tomato')
```

Set `VITE_API_URL=http://localhost:8000` in your `.env` file.

## Adding More Commodities

Just upload more PDFs! The parser auto-detects commodity, market, dates, and prices from any agmarknet report. Upload PDFs for Onion, Potato, etc. and train separate models for each.

## Project Structure

```
mandiq-backend/
├── main.py           # FastAPI app, all endpoints
├── pdf_parser.py     # PDF → structured records
├── database.py       # SQLite persistence
├── model_trainer.py  # XGBoost + LightGBM training
├── predictor.py      # Recursive multi-step forecasting
├── mandiq-api.ts     # Frontend TypeScript client
├── requirements.txt
├── data/
│   └── mandiq.db     # SQLite database
├── models/           # Saved model files (.pkl)
└── uploads/          # Temporary PDF storage
```
