"""
SecureBank – Fraud Detection Backend
FastAPI server that loads a CatBoost model and serves real-time fraud predictions.
"""

import os
import math
from datetime import datetime

import numpy as np
import pandas as pd
from catboost import CatBoostClassifier
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ──────────────────────────────────────────────
# Paths (relative to this file's parent dir)
# ──────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "fraud_model.cbm")
DATA_PATH = os.path.join(BASE_DIR, "fraudTest.csv")

# ──────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────
app = FastAPI(title="SecureBank Fraud Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────
# Global state populated at startup
# ──────────────────────────────────────────────
model: CatBoostClassifier = None
city_lookup: dict = {}        # city -> {lat, long, state, city_pop}
merchant_lookup: dict = {}    # merchant -> {merch_lat, merch_long}
available_merchants: list = []
available_categories: list = []
available_cities: list = []


# ──────────────────────────────────────────────
# Startup: load model + build lookup tables
# ──────────────────────────────────────────────
@app.on_event("startup")
def startup():
    global model, city_lookup, merchant_lookup
    global available_merchants, available_categories, available_cities

    # 1. Load CatBoost model
    print("⏳ Loading CatBoost model …")
    model = CatBoostClassifier()
    model.load_model(MODEL_PATH)
    print(f"✅ Model loaded — {len(model.feature_names_)} features")

    # 2. Read dataset for lookups (only needed columns)
    print("⏳ Building lookup tables from dataset …")
    cols_needed = [
        "merchant", "category", "city", "state", "zip",
        "lat", "long", "city_pop",
        "merch_lat", "merch_long",
    ]
    df = pd.read_csv(DATA_PATH, usecols=cols_needed)

    # City lookup — take the first (or most common) values per city
    city_group = df.groupby("city").agg({
        "lat": "mean",
        "long": "mean",
        "state": "first",
        "zip": "first",
        "city_pop": "first",
    }).to_dict(orient="index")
    city_lookup = city_group

    # Merchant lookup
    merch_group = df.groupby("merchant").agg({
        "merch_lat": "mean",
        "merch_long": "mean",
    }).to_dict(orient="index")
    merchant_lookup = merch_group

    # Unique dropdown options (sorted, capped for frontend usability)
    available_merchants = sorted(df["merchant"].unique().tolist())
    available_categories = sorted(df["category"].unique().tolist())
    available_cities = sorted(df["city"].unique().tolist())

    print(f"✅ Lookups ready — {len(city_lookup)} cities, {len(merchant_lookup)} merchants, {len(available_categories)} categories")


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in km between two lat/lon points."""
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────
class TransactionRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Transaction amount in USD")
    merchant: str = Field(..., description="Merchant name")
    category: str = Field(..., description="Transaction category")
    city: str = Field(..., description="Transaction city")


class PredictionResponse(BaseModel):
    risk_score: int
    probability: float
    risk_level: str
    decision: str


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.get("/options")
def get_options():
    """Return available dropdown values for the frontend."""
    return {
        "merchants": available_merchants,
        "categories": available_categories,
        "cities": available_cities,
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(txn: TransactionRequest):
    """Run fraud prediction on a single transaction."""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    # --- Resolve lookups ---
    city_info = city_lookup.get(txn.city)
    if city_info is None:
        # Fallback: use median values
        lat, lon, state, zipcode, city_pop = 39.8283, -98.5795, "KS", 66101, 50000
    else:
        lat = city_info["lat"]
        lon = city_info["long"]
        state = city_info["state"]
        zipcode = int(city_info["zip"])
        city_pop = city_info["city_pop"]

    merch_info = merchant_lookup.get(txn.merchant)
    if merch_info is None:
        merch_lat, merch_long = lat + 0.01, lon + 0.01  # slight offset
    else:
        merch_lat = merch_info["merch_lat"]
        merch_long = merch_info["merch_long"]

    # --- Time features ---
    now = datetime.now()
    hour = now.hour
    day = now.day
    month = now.month
    weekday = now.weekday()  # 0=Mon
    is_weekend = 1 if weekday >= 5 else 0

    # --- Derived features ---
    age = 35  # reasonable default; real system would use customer DOB
    distance = haversine(lat, lon, merch_lat, merch_long)

    # --- Build feature DataFrame in the exact column order the model expects ---
    # Model order: merchant, category, amt, gender, city, state, zip, lat, long,
    #              city_pop, job, merch_lat, merch_long, hour, day, month,
    #              weekday, is_weekend, age, distance
    feature_dict = {
        "merchant":   txn.merchant,
        "category":   txn.category,
        "amt":        txn.amount,
        "gender":     "M",  # default; real system uses customer profile
        "city":       txn.city,
        "state":      state,
        "zip":        zipcode,
        "lat":        lat,
        "long":       lon,
        "city_pop":   int(city_pop),
        "job":        "Software Engineer",  # default; real system uses profile
        "merch_lat":  merch_lat,
        "merch_long": merch_long,
        "hour":       hour,
        "day":        day,
        "month":      month,
        "weekday":    weekday,
        "is_weekend": is_weekend,
        "age":        age,
        "distance":   distance,
    }

    df_input = pd.DataFrame([feature_dict])

    # --- Predict ---
    proba = model.predict_proba(df_input)[0][1]  # probability of fraud (class 1)
    risk_score = int(round(proba * 100))

    if risk_score >= 70:
        risk_level = "High"
        decision = "Block"
    elif risk_score >= 40:
        risk_level = "Medium"
        decision = "Require OTP"
    else:
        risk_level = "Low"
        decision = "Approve"

    return PredictionResponse(
        risk_score=risk_score,
        probability=round(proba, 4),
        risk_level=risk_level,
        decision=decision,
    )
