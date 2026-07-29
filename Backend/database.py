"""
database.py — SQLite persistence for MandiQ.
Stores parsed price records and training job statuses.
"""

import sqlite3
import json
import logging
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

log = logging.getLogger("mandiq.db")

DB_PATH = "data/mandiq.db"


class MandiDB:
    
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    @contextmanager
    def _conn(self):
        con = sqlite3.connect(self.db_path, check_same_thread=False)
        con.row_factory = sqlite3.Row
        try:
            yield con
            con.commit()
        finally:
            con.close()

    def _init_db(self):
        with self._conn() as con:
            con.executescript("""
                CREATE TABLE IF NOT EXISTS price_records (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    state             TEXT,
                    district          TEXT,
                    market            TEXT    NOT NULL,
                    commodity_grp     TEXT,
                    commodity         TEXT    NOT NULL,
                    date              TEXT    NOT NULL,
                    arrival_qty       REAL,
                    arrival_unit      TEXT,
                    modal_price       REAL    NOT NULL,
                    price_unit        TEXT,
                    producing_region  TEXT,
                    delhi_temp_max    REAL,
                    delhi_temp_min    REAL,
                    delhi_rainfall    REAL,
                    delhi_humidity    REAL,
                    region_temp_max   REAL,
                    region_temp_min   REAL,
                    region_rainfall   REAL,
                    region_humidity   REAL,
                    UNIQUE(commodity, market, date)
                );

                CREATE INDEX IF NOT EXISTS idx_comm_market
                    ON price_records(commodity, market);
                CREATE INDEX IF NOT EXISTS idx_date
                    ON price_records(date);

                CREATE TABLE IF NOT EXISTS training_jobs (
                    model_key   TEXT PRIMARY KEY,
                    status      TEXT NOT NULL,
                    metrics     TEXT,
                    error       TEXT,
                    updated_at  TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE IF NOT EXISTS users (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    mobile          TEXT    UNIQUE NOT NULL,
                    role            TEXT    DEFAULT 'farmer',
                    name            TEXT,
                    farmer_details  TEXT,
                    created_at      TEXT    DEFAULT (datetime('now'))
                );
                
            """)
        log.info(f"DB ready: {self.db_path}")
    def get_or_create_user(self, mobile: str, role: str = 'farmer') -> dict:
        with self._conn() as con:
            con.execute("INSERT OR IGNORE INTO users (mobile, role) VALUES (?, ?)", (mobile, role))
            row = con.execute("SELECT * FROM users WHERE mobile = ?", (mobile,)).fetchone()
        return dict(row)

    def get_user_by_id(self, user_id: int) -> dict:
        with self._conn() as con:
            row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    # ─── Upsert records ────────────────────────────────────────────────────────
    def upsert_records(self, records: List[Dict[str, Any]]) -> int:
        inserted = 0
        with self._conn() as con:
            for r in records:
                try:
                    con.execute("""
                        INSERT INTO price_records
                            (state, district, market, commodity_grp, commodity,
                             date, arrival_qty, arrival_unit, modal_price, price_unit,
                             producing_region, delhi_temp_max, delhi_temp_min, delhi_rainfall, delhi_humidity,
                             region_temp_max, region_temp_min, region_rainfall, region_humidity)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        ON CONFLICT(commodity, market, date) DO UPDATE SET
                            modal_price = excluded.modal_price,
                            arrival_qty = excluded.arrival_qty,
                            producing_region = excluded.producing_region,
                            delhi_temp_max = excluded.delhi_temp_max,
                            delhi_temp_min = excluded.delhi_temp_min,
                            delhi_rainfall = excluded.delhi_rainfall,
                            delhi_humidity = excluded.delhi_humidity,
                            region_temp_max = excluded.region_temp_max,
                            region_temp_min = excluded.region_temp_min,
                            region_rainfall = excluded.region_rainfall,
                            region_humidity = excluded.region_humidity
                    """, (
                        r.get("state"), r.get("district"), r["market"],
                        r.get("group"), r["commodity"], r["date"],
                        r.get("arrival_qty"), r.get("arrival_unit"),
                        r["modal_price"], r.get("price_unit"),
                        r.get("producing_region"),
                        r.get("delhi_temp_max"), r.get("delhi_temp_min"),
                        r.get("delhi_rainfall"), r.get("delhi_humidity"),
                        r.get("region_temp_max"), r.get("region_temp_min"),
                        r.get("region_rainfall"), r.get("region_humidity"),
                    ))
                    inserted += 1
                except Exception as e:
                    log.warning(f"Upsert failed: {e} | record={r}")
        return inserted

    # ─── Query ────────────────────────────────────────────────────────────────
    def get_data(
        self,
        commodity: str,
        market: str = "Azadpur APMC",
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> List[Dict]:
        sql = """
            SELECT date, modal_price, arrival_qty, arrival_unit, price_unit,
                   producing_region, delhi_temp_max, delhi_temp_min, delhi_rainfall, delhi_humidity,
                   region_temp_max, region_temp_min, region_rainfall, region_humidity
            FROM price_records
            WHERE commodity = ? AND market = ?
        """
        params: list = [commodity, market]

        if start:
            sql += " AND date >= ?"
            params.append(start)
        if end:
            sql += " AND date <= ?"
            params.append(end)

        sql += " ORDER BY date ASC"

        with self._conn() as con:
            rows = con.execute(sql, params).fetchall()

        return [dict(r) for r in rows]

    # ─── Commodities list ─────────────────────────────────────────────────────
    def list_commodities(self) -> List[Dict]:
        with self._conn() as con:
            rows = con.execute("""
                SELECT
                    commodity,
                    market,
                    COUNT(*) as records,
                    MIN(date) as start_date,
                    MAX(date) as end_date,
                    ROUND(AVG(modal_price), 2) as avg_price,
                    ROUND(MIN(modal_price), 2) as min_price,
                    ROUND(MAX(modal_price), 2) as max_price
                FROM price_records
                GROUP BY commodity, market
                ORDER BY commodity
            """).fetchall()
        return [dict(r) for r in rows]

    # ─── Statistics ───────────────────────────────────────────────────────────
    def get_stats(self, commodity: str, market: str) -> Dict:
        with self._conn() as con:
            basic = con.execute("""
                SELECT
                    COUNT(*) as total_records,
                    MIN(date)  as start_date,
                    MAX(date)  as end_date,
                    ROUND(AVG(modal_price), 2) as avg_price,
                    ROUND(MIN(modal_price), 2) as min_price,
                    ROUND(MAX(modal_price), 2) as max_price,
                    ROUND(
                        100.0 * (MAX(modal_price) - MIN(modal_price)) / MIN(modal_price),
                        1
                    ) as price_swing_pct
                FROM price_records
                WHERE commodity = ? AND market = ?
            """, (commodity, market)).fetchone()

            if not basic or basic["total_records"] == 0:
                return {}

            monthly = con.execute("""
                SELECT
                    strftime('%m', date) as month_num,
                    CASE strftime('%m', date)
                        WHEN '01' THEN 'Jan' WHEN '02' THEN 'Feb'
                        WHEN '03' THEN 'Mar' WHEN '04' THEN 'Apr'
                        WHEN '05' THEN 'May' WHEN '06' THEN 'Jun'
                        WHEN '07' THEN 'Jul' WHEN '08' THEN 'Aug'
                        WHEN '09' THEN 'Sep' WHEN '10' THEN 'Oct'
                        WHEN '11' THEN 'Nov' WHEN '12' THEN 'Dec'
                    END as month,
                    ROUND(AVG(modal_price), 2) as avg_price,
                    COUNT(*) as records
                FROM price_records
                WHERE commodity = ? AND market = ?
                GROUP BY month_num
                ORDER BY month_num
            """, (commodity, market)).fetchall()

            yearly = con.execute("""
                SELECT
                    strftime('%Y', date) as year,
                    ROUND(AVG(modal_price), 2) as avg_price,
                    COUNT(*) as records
                FROM price_records
                WHERE commodity = ? AND market = ?
                GROUP BY year
                ORDER BY year
            """, (commodity, market)).fetchall()

            spikes = con.execute("""
                SELECT date, modal_price, arrival_qty
                FROM price_records
                WHERE commodity = ? AND market = ?
                ORDER BY modal_price DESC
                LIMIT 5
            """, (commodity, market)).fetchall()

            lows = con.execute("""
                SELECT date, modal_price, arrival_qty
                FROM price_records
                WHERE commodity = ? AND market = ?
                ORDER BY modal_price ASC
                LIMIT 5
            """, (commodity, market)).fetchall()

        return {
            "commodity": commodity,
            "market": market,
            **dict(basic),
            "monthly_avg": [dict(r) for r in monthly],
            "yearly_avg": [dict(r) for r in yearly],
            "price_spikes": [dict(r) for r in spikes],
            "price_lows": [dict(r) for r in lows],
        }

    # ─── Training job status ──────────────────────────────────────────────────
    def set_training_status(
        self,
        model_key: str,
        status: str,
        metrics: Optional[Dict] = None,
        error: Optional[str] = None,
    ):
        with self._conn() as con:
            con.execute("""
                INSERT INTO training_jobs (model_key, status, metrics, error, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
                ON CONFLICT(model_key) DO UPDATE SET
                    status = excluded.status,
                    metrics = excluded.metrics,
                    error = excluded.error,
                    updated_at = excluded.updated_at
            """, (model_key, status, json.dumps(metrics) if metrics else None, error))

    def get_training_status(self, model_key: str) -> Optional[Dict]:
        with self._conn() as con:
            row = con.execute(
                "SELECT * FROM training_jobs WHERE model_key = ?", (model_key,)
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        if result.get("metrics"):
            result["metrics"] = json.loads(result["metrics"])
        return result

    # ─── Delete data ──────────────────────────────────────────────────────────
    def delete_data(self, commodity: str, market: str):
        with self._conn() as con:
            con.execute(
                "DELETE FROM price_records WHERE commodity = ? AND market = ?",
                (commodity, market),
            )
    def update_user_profile(self, user_id: int, name: str, user_type: str, farmer_details: dict):
        import json
        with self._conn() as con:
            con.execute("""
                UPDATE users 
                SET name = ?, role = ?, farmer_details = ?
                WHERE id = ?
            """, (name, user_type, json.dumps(farmer_details), user_id))
            