"""
database.py — Hybrid SQLite/MongoDB persistence for MandiQ.
Automatically routes queries to MongoDB if MONGO_URI is defined, 
otherwise falls back to local SQLite database.
"""

import os
import json
import logging
import urllib.parse
from datetime import datetime
from typing import List, Dict, Any, Optional
from contextlib import contextmanager
from dotenv import load_dotenv

# SQLite backend imports
import sqlite3

# MongoDB backend imports
try:
    import pymongo
    from pymongo import ReturnDocument, UpdateOne
except ImportError:
    pymongo = None

load_dotenv()
log = logging.getLogger("mandiq.db")
DB_PATH = "data/mandiq.db"


def _now_str() -> str:
    """Returns current UTC time in SQLite format YYYY-MM-DD HH:MM:SS"""
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ==============================================================================
# SQLITE IMPLEMENTATION
# ==============================================================================
class MandiSQLiteDB:
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

                CREATE TABLE IF NOT EXISTS price_alerts (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id         INTEGER NOT NULL,
                    mobile          TEXT    NOT NULL,
                    crop            TEXT    NOT NULL,
                    market          TEXT    NOT NULL DEFAULT 'Azadpur APMC',
                    target_price    REAL    NOT NULL,
                    direction       TEXT    NOT NULL DEFAULT 'above',
                    triggered       INTEGER NOT NULL DEFAULT 0,
                    triggered_at    TEXT,
                    created_at      TEXT    DEFAULT (datetime('now')),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS prediction_feedback (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id         INTEGER,
                    crop            TEXT    NOT NULL,
                    market          TEXT    NOT NULL,
                    accurate        TEXT    NOT NULL CHECK(accurate IN ('yes','no')),
                    comment         TEXT    DEFAULT '',
                    created_at      TEXT    DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS app_ratings (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id     INTEGER,
                    stars       INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
                    feedback    TEXT    DEFAULT '',
                    created_at  TEXT    DEFAULT (datetime('now'))
                );
            """)
        log.info(f"SQLite DB ready: {self.db_path}")

    def get_or_create_user(self, mobile: str, role: str = 'farmer') -> dict:
        with self._conn() as con:
            con.execute("INSERT OR IGNORE INTO users (mobile, role) VALUES (?, ?)", (mobile, role))
            row = con.execute("SELECT * FROM users WHERE mobile = ?", (mobile,)).fetchone()
        return dict(row)

    def get_user_by_id(self, user_id: int) -> dict:
        with self._conn() as con:
            row = con.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

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

    def delete_data(self, commodity: str, market: str):
        with self._conn() as con:
            con.execute(
                "DELETE FROM price_records WHERE commodity = ? AND market = ?",
                (commodity, market),
            )

    def update_user_profile(self, user_id: int, name: str, user_type: str, farmer_details: dict):
        with self._conn() as con:
            con.execute("""
                UPDATE users
                SET name = ?, role = ?, farmer_details = ?
                WHERE id = ?
            """, (name, user_type, json.dumps(farmer_details), user_id))

    def create_alert(self, user_id: int, mobile: str, crop: str, market: str, target_price: float, direction: str = "above") -> int:
        with self._conn() as con:
            cur = con.execute(
                "INSERT INTO price_alerts (user_id, mobile, crop, market, target_price, direction) VALUES (?,?,?,?,?,?)",
                (user_id, mobile, crop, market, target_price, direction)
            )
            return cur.lastrowid

    def get_alerts(self, user_id: int) -> List[Dict]:
        with self._conn() as con:
            rows = con.execute(
                "SELECT * FROM price_alerts WHERE user_id = ? AND triggered = 0 ORDER BY created_at DESC",
                (user_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_alert(self, alert_id: int, user_id: int):
        with self._conn() as con:
            con.execute("DELETE FROM price_alerts WHERE id = ? AND user_id = ?", (alert_id, user_id))

    def get_all_active_alerts(self) -> List[Dict]:
        with self._conn() as con:
            rows = con.execute(
                "SELECT * FROM price_alerts WHERE triggered = 0"
            ).fetchall()
        return [dict(r) for r in rows]

    def mark_alert_triggered(self, alert_id: int):
        with self._conn() as con:
            con.execute(
                "UPDATE price_alerts SET triggered = 1, triggered_at = datetime('now') WHERE id = ?",
                (alert_id,)
            )

    def save_prediction_feedback(self, user_id, crop: str, market: str, accurate: str, comment: str = "") -> int:
        with self._conn() as con:
            cur = con.execute(
                "INSERT INTO prediction_feedback (user_id, crop, market, accurate, comment) VALUES (?,?,?,?,?)",
                (user_id, crop, market, accurate, comment)
            )
            return cur.lastrowid

    def save_rating(self, user_id: int, stars: int, feedback: str = "") -> int:
        with self._conn() as con:
            cur = con.execute(
                "INSERT INTO app_ratings (user_id, stars, feedback) VALUES (?,?,?)",
                (user_id, stars, feedback)
            )
            return cur.lastrowid

    def get_rating_stats(self) -> dict:
        with self._conn() as con:
            row = con.execute("""
                SELECT COUNT(*) as total, ROUND(AVG(stars), 1) as avg_stars
                FROM app_ratings
            """).fetchone()
        return dict(row) if row else {"total": 0, "avg_stars": 0}

    def get_commodity_data_all_markets(self, commodity: str) -> List[Dict]:
        sql = """
            SELECT market, date, modal_price, arrival_qty
            FROM price_records
            WHERE commodity = ?
            ORDER BY date ASC
        """
        with self._conn() as con:
            rows = con.execute(sql, [commodity]).fetchall()
        return [dict(r) for r in rows]

    def get_all_price_records(self) -> List[Dict]:
        sql = """
            SELECT commodity, market, date, modal_price, arrival_qty
            FROM price_records
            ORDER BY date ASC
        """
        with self._conn() as con:
            rows = con.execute(sql).fetchall()
        return [dict(r) for r in rows]


# ==============================================================================
# MONGODB IMPLEMENTATION
# ==============================================================================
class MandiMongoDB:
    def __init__(self, mongo_uri: str):
        if pymongo is None:
            raise ImportError(
                "pymongo package is not installed. Run 'pip install pymongo dnspython'"
            )
        self.client = pymongo.MongoClient(mongo_uri)
        
        # Parse database name from URI, default to 'mandiq'
        parsed = urllib.parse.urlparse(mongo_uri)
        db_name = parsed.path.strip('/') if parsed.path else "mandiq"
        self.db = self.client[db_name]
        
        self._init_db()

    def _init_db(self):
        # Create indexes
        self.db.price_records.create_index(
            [("commodity", pymongo.ASCENDING), ("market", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
            unique=True
        )
        self.db.price_records.create_index([("date", pymongo.ASCENDING)])
        self.db.users.create_index([("mobile", pymongo.ASCENDING)], unique=True)
        self.db.training_jobs.create_index([("model_key", pymongo.ASCENDING)], unique=True)
        self.db.price_alerts.create_index([("id", pymongo.ASCENDING)], unique=True)
        
        log.info(f"MongoDB DB ready: {self.db.name}")

    def _get_next_sequence(self, name: str) -> int:
        ret = self.db.counters.find_one_and_update(
            {"_id": name},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
        return ret["seq"]

    def get_or_create_user(self, mobile: str, role: str = 'farmer') -> dict:
        user = self.db.users.find_one({"mobile": mobile})
        if not user:
            seq = self._get_next_sequence("users")
            user = {
                "id": seq,
                "mobile": mobile,
                "role": role,
                "name": None,
                "farmer_details": None,
                "created_at": _now_str()
            }
            self.db.users.insert_one(user)
        user.pop("_id", None)
        return user

    def get_user_by_id(self, user_id: int) -> dict:
        user = self.db.users.find_one({"id": int(user_id)})
        if user:
            user.pop("_id", None)
        return user

    def upsert_records(self, records: List[Dict[str, Any]]) -> int:
        inserted = 0
        operations = []
        for r in records:
            query = {
                "commodity": r["commodity"],
                "market": r["market"],
                "date": r["date"]
            }
            update = {
                "$set": {
                    "state": r.get("state"),
                    "district": r.get("district"),
                    "commodity_grp": r.get("group"),
                    "arrival_qty": r.get("arrival_qty"),
                    "arrival_unit": r.get("arrival_unit"),
                    "modal_price": r["modal_price"],
                    "price_unit": r.get("price_unit"),
                    "producing_region": r.get("producing_region"),
                    "delhi_temp_max": r.get("delhi_temp_max"),
                    "delhi_temp_min": r.get("delhi_temp_min"),
                    "delhi_rainfall": r.get("delhi_rainfall"),
                    "delhi_humidity": r.get("delhi_humidity"),
                    "region_temp_max": r.get("region_temp_max"),
                    "region_temp_min": r.get("region_temp_min"),
                    "region_rainfall": r.get("region_rainfall"),
                    "region_humidity": r.get("region_humidity")
                }
            }
            operations.append(UpdateOne(query, update, upsert=True))
            
        if operations:
            try:
                res = self.db.price_records.bulk_write(operations, ordered=False)
                inserted = (res.upserted_count or 0) + (res.modified_count or 0)
            except Exception as e:
                log.warning(f"MongoDB bulk upsert failed: {e}")
                # Fallback to single upserts to count successful ones
                for op in operations:
                    try:
                        self.db.price_records.update_one(op._filter, op._doc, upsert=True)
                        inserted += 1
                    except Exception as ex:
                        log.warning(f"MongoDB upsert failed: {ex} | query={op._filter}")
        return inserted

    def get_data(
        self,
        commodity: str,
        market: str = "Azadpur APMC",
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> List[Dict]:
        query = {"commodity": commodity, "market": market}
        if start or end:
            query["date"] = {}
            if start:
                query["date"]["$gte"] = start
            if end:
                query["date"]["$lte"] = end
                
        cursor = self.db.price_records.find(
            query,
            {
                "_id": 0,
                "date": 1,
                "modal_price": 1,
                "arrival_qty": 1,
                "arrival_unit": 1,
                "price_unit": 1,
                "producing_region": 1,
                "delhi_temp_max": 1,
                "delhi_temp_min": 1,
                "delhi_rainfall": 1,
                "delhi_humidity": 1,
                "region_temp_max": 1,
                "region_temp_min": 1,
                "region_rainfall": 1,
                "region_humidity": 1
            }
        ).sort("date", pymongo.ASCENDING)
        return list(cursor)

    def list_commodities(self) -> List[Dict]:
        pipeline = [
            {
                "$group": {
                    "_id": {"commodity": "$commodity", "market": "$market"},
                    "records": {"$sum": 1},
                    "start_date": {"$min": "$date"},
                    "end_date": {"$max": "$date"},
                    "avg_price": {"$avg": "$modal_price"},
                    "min_price": {"$min": "$modal_price"},
                    "max_price": {"$max": "$modal_price"}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "commodity": "$_id.commodity",
                    "market": "$_id.market",
                    "records": 1,
                    "start_date": 1,
                    "end_date": 1,
                    "avg_price": {"$round": ["$avg_price", 2]},
                    "min_price": {"$round": ["$min_price", 2]},
                    "max_price": {"$round": ["$max_price", 2]}
                }
            },
            {"$sort": {"commodity": 1}}
        ]
        return list(self.db.price_records.aggregate(pipeline))

    def get_stats(self, commodity: str, market: str) -> Dict:
        pipeline = [
            {"$match": {"commodity": commodity, "market": market}},
            {
                "$group": {
                    "_id": None,
                    "total_records": {"$sum": 1},
                    "start_date": {"$min": "$date"},
                    "end_date": {"$max": "$date"},
                    "avg_price": {"$avg": "$modal_price"},
                    "min_price": {"$min": "$modal_price"},
                    "max_price": {"$max": "$modal_price"}
                }
            }
        ]
        res = list(self.db.price_records.aggregate(pipeline))
        if not res or res[0]["total_records"] == 0:
            return {}

        basic = res[0]
        min_price = basic["min_price"]
        max_price = basic["max_price"]
        basic["price_swing_pct"] = round(100.0 * (max_price - min_price) / min_price, 1) if min_price > 0 else 0.0
        basic["avg_price"] = round(basic["avg_price"], 2)
        basic["min_price"] = round(basic["min_price"], 2)
        basic["max_price"] = round(basic["max_price"], 2)
        basic.pop("_id", None)

        # Monthly averages using substring extraction of YYYY-MM-DD
        month_pipeline = [
            {"$match": {"commodity": commodity, "market": market}},
            {
                "$group": {
                    "_id": {"$substrCP": ["$date", 5, 2]},
                    "avg_price": {"$avg": "$modal_price"},
                    "records": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        month_map = {
            '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
            '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
            '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec'
        }
        monthly_avg = []
        for item in self.db.price_records.aggregate(month_pipeline):
            month_num = item["_id"]
            monthly_avg.append({
                "month_num": month_num,
                "month": month_map.get(month_num, month_num),
                "avg_price": round(item["avg_price"], 2),
                "records": item["records"]
            })

        # Yearly averages using substring extraction
        year_pipeline = [
            {"$match": {"commodity": commodity, "market": market}},
            {
                "$group": {
                    "_id": {"$substrCP": ["$date", 0, 4]},
                    "avg_price": {"$avg": "$modal_price"},
                    "records": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        yearly_avg = []
        for item in self.db.price_records.aggregate(year_pipeline):
            yearly_avg.append({
                "year": item["_id"],
                "avg_price": round(item["avg_price"], 2),
                "records": item["records"]
            })

        # Spikes (top 5)
        spikes = list(self.db.price_records.find(
            {"commodity": commodity, "market": market},
            {"_id": 0, "date": 1, "modal_price": 1, "arrival_qty": 1}
        ).sort("modal_price", pymongo.DESCENDING).limit(5))

        # Lows (top 5)
        lows = list(self.db.price_records.find(
            {"commodity": commodity, "market": market},
            {"_id": 0, "date": 1, "modal_price": 1, "arrival_qty": 1}
        ).sort("modal_price", pymongo.ASCENDING).limit(5))

        return {
            "commodity": commodity,
            "market": market,
            **basic,
            "monthly_avg": monthly_avg,
            "yearly_avg": yearly_avg,
            "price_spikes": spikes,
            "price_lows": lows,
        }

    def set_training_status(
        self,
        model_key: str,
        status: str,
        metrics: Optional[Dict] = None,
        error: Optional[str] = None,
    ):
        self.db.training_jobs.update_one(
            {"model_key": model_key},
            {
                "$set": {
                    "status": status,
                    "metrics": metrics,
                    "error": error,
                    "updated_at": _now_str()
                }
            },
            upsert=True
        )

    def get_training_status(self, model_key: str) -> Optional[Dict]:
        job = self.db.training_jobs.find_one({"model_key": model_key})
        if job:
            job.pop("_id", None)
            if isinstance(job.get("metrics"), str):
                try:
                    job["metrics"] = json.loads(job["metrics"])
                except Exception:
                    pass
        return job

    def delete_data(self, commodity: str, market: str):
        self.db.price_records.delete_many({"commodity": commodity, "market": market})

    def update_user_profile(self, user_id: int, name: str, user_type: str, farmer_details: dict):
        self.db.users.update_one(
            {"id": int(user_id)},
            {
                "$set": {
                    "name": name,
                    "role": user_type,
                    "farmer_details": farmer_details
                }
            }
        )

    def create_alert(self, user_id: int, mobile: str, crop: str, market: str, target_price: float, direction: str = "above") -> int:
        seq = self._get_next_sequence("price_alerts")
        alert = {
            "id": seq,
            "user_id": int(user_id),
            "mobile": mobile,
            "crop": crop,
            "market": market,
            "target_price": target_price,
            "direction": direction,
            "triggered": 0,
            "triggered_at": None,
            "created_at": _now_str()
        }
        self.db.price_alerts.insert_one(alert)
        return seq

    def get_alerts(self, user_id: int) -> List[Dict]:
        cursor = self.db.price_alerts.find(
            {"user_id": int(user_id), "triggered": 0}
        ).sort("created_at", pymongo.DESCENDING)
        
        results = []
        for r in cursor:
            r.pop("_id", None)
            results.append(r)
        return results

    def delete_alert(self, alert_id: int, user_id: int):
        self.db.price_alerts.delete_one({"id": int(alert_id), "user_id": int(user_id)})

    def get_all_active_alerts(self) -> List[Dict]:
        cursor = self.db.price_alerts.find({"triggered": 0})
        results = []
        for r in cursor:
            r.pop("_id", None)
            results.append(r)
        return results

    def mark_alert_triggered(self, alert_id: int):
        self.db.price_alerts.update_one(
            {"id": int(alert_id)},
            {"$set": {"triggered": 1, "triggered_at": _now_str()}}
        )

    def save_prediction_feedback(self, user_id, crop: str, market: str, accurate: str, comment: str = "") -> int:
        seq = self._get_next_sequence("prediction_feedback")
        feedback = {
            "id": seq,
            "user_id": int(user_id) if user_id is not None else None,
            "crop": crop,
            "market": market,
            "accurate": accurate,
            "comment": comment,
            "created_at": _now_str()
        }
        self.db.prediction_feedback.insert_one(feedback)
        return seq

    def save_rating(self, user_id: int, stars: int, feedback: str = "") -> int:
        seq = self._get_next_sequence("app_ratings")
        rating = {
            "id": seq,
            "user_id": int(user_id) if user_id is not None else None,
            "stars": int(stars),
            "feedback": feedback,
            "created_at": _now_str()
        }
        self.db.app_ratings.insert_one(rating)
        return seq

    def get_rating_stats(self) -> dict:
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": 1},
                    "avg_stars": {"$avg": "$stars"}
                }
            }
        ]
        res = list(self.db.app_ratings.aggregate(pipeline))
        if not res:
            return {"total": 0, "avg_stars": 0}
        return {
            "total": res[0]["total"],
            "avg_stars": round(res[0]["avg_stars"], 1)
        }

    def get_commodity_data_all_markets(self, commodity: str) -> List[Dict]:
        cursor = self.db.price_records.find(
            {"commodity": commodity},
            {"_id": 0, "market": 1, "date": 1, "modal_price": 1, "arrival_qty": 1}
        ).sort("date", pymongo.ASCENDING)
        return list(cursor)

    def get_all_price_records(self) -> List[Dict]:
        cursor = self.db.price_records.find(
            {},
            {"_id": 0, "commodity": 1, "market": 1, "date": 1, "modal_price": 1, "arrival_qty": 1}
        ).sort("date", pymongo.ASCENDING)
        return list(cursor)


# ==============================================================================
# MAIN ROUTING CLASS
# ==============================================================================
class MandiDB:
    def __init__(self, db_path: str = DB_PATH):
        mongo_uri = os.getenv("MONGO_URI")
        if mongo_uri:
            log.info("MandiDB: Routed to MongoDB backend.")
            self._impl = MandiMongoDB(mongo_uri)
        else:
            log.info(f"MandiDB: Routed to SQLite backend ({db_path}).")
            self._impl = MandiSQLiteDB(db_path)

    def get_or_create_user(self, mobile: str, role: str = 'farmer') -> dict:
        return self._impl.get_or_create_user(mobile, role)

    def get_user_by_id(self, user_id: int) -> dict:
        return self._impl.get_user_by_id(user_id)

    def upsert_records(self, records: List[Dict[str, Any]]) -> int:
        return self._impl.upsert_records(records)

    def get_data(
        self,
        commodity: str,
        market: str = "Azadpur APMC",
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> List[Dict]:
        return self._impl.get_data(commodity, market, start, end)

    def list_commodities(self) -> List[Dict]:
        return self._impl.list_commodities()

    def get_stats(self, commodity: str, market: str) -> Dict:
        return self._impl.get_stats(commodity, market)

    def set_training_status(
        self,
        model_key: str,
        status: str,
        metrics: Optional[Dict] = None,
        error: Optional[str] = None,
    ):
        self._impl.set_training_status(model_key, status, metrics, error)

    def get_training_status(self, model_key: str) -> Optional[Dict]:
        return self._impl.get_training_status(model_key)

    def delete_data(self, commodity: str, market: str):
        self._impl.delete_data(commodity, market)

    def update_user_profile(self, user_id: int, name: str, user_type: str, farmer_details: dict):
        self._impl.update_user_profile(user_id, name, user_type, farmer_details)

    def create_alert(self, user_id: int, mobile: str, crop: str, market: str, target_price: float, direction: str = "above") -> int:
        return self._impl.create_alert(user_id, mobile, crop, market, target_price, direction)

    def get_alerts(self, user_id: int) -> List[Dict]:
        return self._impl.get_alerts(user_id)

    def delete_alert(self, alert_id: int, user_id: int):
        self._impl.delete_alert(alert_id, user_id)

    def get_all_active_alerts(self) -> List[Dict]:
        return self._impl.get_all_active_alerts()

    def mark_alert_triggered(self, alert_id: int):
        self._impl.mark_alert_triggered(alert_id)

    def save_prediction_feedback(self, user_id, crop: str, market: str, accurate: str, comment: str = "") -> int:
        return self._impl.save_prediction_feedback(user_id, crop, market, accurate, comment)

    def save_rating(self, user_id: int, stars: int, feedback: str = "") -> int:
        return self._impl.save_rating(user_id, stars, feedback)

    def get_rating_stats(self) -> dict:
        return self._impl.get_rating_stats()

    def get_commodity_data_all_markets(self, commodity: str) -> List[Dict]:
        return self._impl.get_commodity_data_all_markets(commodity)

    def get_all_price_records(self) -> List[Dict]:
        return self._impl.get_all_price_records()
