/**
 * mandiq-api.ts
 * Drop this in your src/ folder — it connects all frontend components to the MandiQ backend.
 *
 * Usage:
 *   import { mandiApi } from '@/mandiq-api'
 *   const predictions = await mandiApi.predict('Tomato', 30)
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceRecord {
  date: string;
  modal_price: number;
  arrival_qty: number | null;
  arrival_unit: string;
  price_unit: string;
}

export interface Prediction {
  date: string;
  predicted_price: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
  unit: string;
}

export interface CommodityInfo {
  commodity: string;
  market: string;
  records: number;
  start_date: string;
  end_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
}

export interface TrainStatus {
  model_key: string;
  status: "queued" | "training" | "done" | "failed";
  metrics?: {
    cv_mape_avg: number;
    hold_out_mape: number;
    hold_out_mae: number;
    hold_out_rmse: number;
    records_used: number;
    features_used: number;
    model_type: string;
    trained_at: string;
    date_range: { start: string; end: string };
  };
  error?: string;
  updated_at: string;
}

export interface Stats {
  commodity: string;
  market: string;
  total_records: number;
  start_date: string;
  end_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  price_swing_pct: number;
  monthly_avg: { month: string; avg_price: number; records: number }[];
  yearly_avg: { year: string; avg_price: number; records: number }[];
  price_spikes: { date: string; modal_price: number }[];
  price_lows: { date: string; modal_price: number }[];
}

export interface SeasonalData {
  monthly_seasonality: {
    month: string;
    avg_price: number;
    std_price: number;
    samples: number;
  }[];
  best_months_to_buy: { month: string; avg_price: number }[];
  best_months_to_sell: { month: string; avg_price: number }[];
}

// ─── API Client ───────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const mandiApi = {

  /** Check backend health */
  health: () => request<{ status: string; commodities_in_db: number; trained_models: string[] }>("/health"),

  /** Upload a mandi PDF for parsing */
  uploadPdf: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE_URL}/api/upload`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<{
      status: string;
      file: string;
      records_parsed: number;
      records_inserted: number;
      commodities: string[];
      date_range: { start: string; end: string };
    }>;
  },

  /** List all commodities stored in DB */
  listCommodities: () =>
    request<{ commodities: CommodityInfo[] }>("/api/commodities").then((r) => r.commodities),

  /** Get historical price records */
  getHistory: (commodity: string, market = "Azadpur APMC", start?: string, end?: string) => {
    const params = new URLSearchParams({ commodity, market });
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return request<{ count: number; data: PriceRecord[] }>(`/api/history?${params}`).then(
      (r) => r.data,
    );
  },

  /** Get rich statistics for a commodity */
  getStats: (commodity: string, market = "Azadpur APMC") => {
    const params = new URLSearchParams({ commodity, market });
    return request<Stats>(`/api/stats?${params}`);
  },

  /** Start model training (async — poll trainStatus) */
  trainModel: (commodity: string, market = "Azadpur APMC", modelType: "ensemble" | "xgboost" | "lightgbm" = "ensemble") =>
    request<{ status: string; message: string; model_key: string; records_used: number }>("/api/train", {
      method: "POST",
      body: JSON.stringify({ commodity, market, model_type: modelType }),
    }),

  /** Poll training status */
  trainStatus: (commodity: string, market = "Azadpur APMC") => {
    const params = new URLSearchParams({ commodity, market });
    return request<TrainStatus>(`/api/train/status?${params}`);
  },

  /** Poll until training is done (resolves with final status) */
  waitForTraining: async (
    commodity: string,
    market = "Azadpur APMC",
    onUpdate?: (status: TrainStatus) => void,
    intervalMs = 2000,
  ): Promise<TrainStatus> => {
    return new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        try {
          const status = await mandiApi.trainStatus(commodity, market);
          onUpdate?.(status);
          if (status.status === "done") {
            clearInterval(poll);
            resolve(status);
          } else if (status.status === "failed") {
            clearInterval(poll);
            reject(new Error(status.error ?? "Training failed"));
          }
        } catch (e) {
          clearInterval(poll);
          reject(e);
        }
      }, intervalMs);
    });
  },

  /** Get model metadata and performance */
  modelInfo: (commodity: string, market = "Azadpur APMC") => {
    const params = new URLSearchParams({ commodity, market });
    return request<{
      commodity: string;
      market: string;
      metrics: TrainStatus["metrics"];
      feature_count: number;
      models: string[];
      feature_importance: Record<string, Record<string, number>>;
    }>(`/api/model/info?${params}`);
  },

  /** Predict future prices */
  predict: (commodity: string, daysAhead = 30, market = "Azadpur APMC") => {
    const params = new URLSearchParams({ commodity, market, days_ahead: String(daysAhead) });
    return request<{ predictions: Prediction[] }>(`/api/predict?${params}`).then(
      (r) => r.predictions,
    );
  },

  /** Month-wise seasonal patterns */
  seasonal: (commodity: string, market = "Azadpur APMC") => {
    const params = new URLSearchParams({ commodity, market });
    return request<SeasonalData>(`/api/seasonal?${params}`);
  },

  /** Delete all data for a commodity */
  deleteData: (commodity: string, market = "Azadpur APMC") => {
    const params = new URLSearchParams({ commodity, market });
    return request<{ status: string }>(`/api/data?${params}`, { method: "DELETE" });
  },
};

export default mandiApi;
