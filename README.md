# 🏦 SecureBank – Credit Card Fraud Detection System

A full-stack credit card fraud detection application with a premium fintech-style dashboard and real-time ML predictions powered by a CatBoost model.

![Risk Analysis Dashboard](https://img.shields.io/badge/CatBoost-ML_Model-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688) ![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-Frontend-F7DF1E)

---

## 📋 Features

- **Transaction Risk Scoring** — Submit transaction details and get real-time fraud probability from a trained CatBoost model
- **Animated Risk Gauge** — Circular meter (0–100) color-coded green/yellow/red
- **Smart Decision Engine** — Auto-classifies transactions as Approve, Require OTP, or Block
- **Dynamic Dropdowns** — 693 merchants, 14 categories, 849 cities loaded from real training data
- **Transaction History** — Running table of all analyzed transactions with status badges
- **Customer Profile Card** — Displays customer info and live risk badge
- **Responsive Design** — Works on desktop and mobile

---

## 🗂️ Project Structure

```
Credit_card/
├── frontend/                  # Static frontend (HTML/CSS/JS)
│   ├── index.html             # Dashboard UI
│   ├── style.css              # Fintech design system
│   ├── app.js                 # API calls, gauge animation, history
│   └── package.json           # npm run dev script
│
├── backend/                   # FastAPI backend
│   ├── main.py                # API server, model loading, feature engineering
│   └── requirements.txt       # Python dependencies
│
├── fraud_model.cbm            # Trained CatBoost model
├── fraudTest.csv              # Dataset (used for lookup tables)
└── Credit_card_fraud_detection_ML.ipynb  # Model training notebook
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js / npm** (for frontend dev server)

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Start the Backend (Terminal 1)

```bash
cd backend
python -m uvicorn main:app --port 8000
```

Wait until you see:
```
✅ Model loaded — 20 features
✅ Lookups ready — 849 cities, 693 merchants, 14 categories
INFO:     Application startup complete.
```

### 3. Start the Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

### 4. Open in Browser

```
http://localhost:8090
```

---

## 🔌 API Endpoints

| Method | Endpoint   | Description                          |
|--------|-----------|--------------------------------------|
| GET    | `/health`  | Health check                         |
| GET    | `/options` | Returns available merchants, categories, cities |
| POST   | `/predict` | Returns fraud risk prediction        |

### POST `/predict` — Request

```json
{
  "amount": 7500,
  "merchant": "fraud_Kirlin and Sons",
  "category": "shopping_net",
  "city": "Aliso Viejo"
}
```

### POST `/predict` — Response

```json
{
  "risk_score": 89,
  "probability": 0.886,
  "risk_level": "High",
  "decision": "Block"
}
```

---

## 🧠 ML Model

- **Algorithm**: CatBoost Classifier
- **Features**: 20 (merchant, category, amount, gender, city, state, zip, lat, long, city_pop, job, merch_lat, merch_long, hour, day, month, weekday, is_weekend, age, distance)
- **Target**: `is_fraud` (binary classification)
- **Training data**: `fraudTest.csv` (~54,000 transactions)

The backend automatically engineers all 20 features from just 4 user inputs (amount, merchant, category, city) using lookup tables and haversine distance calculation.

---

## 🛠️ Tech Stack

| Layer    | Technology                     |
|----------|-------------------------------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend  | Python, FastAPI, Uvicorn      |
| ML Model | CatBoost                      |
| Data     | Pandas, NumPy                 |

---

## 📄 License

This project is for educational and demonstration purposes.
