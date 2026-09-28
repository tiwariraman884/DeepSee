# DeepSea Guardian (DeepSee)

> **DeepSea Guardian** is an enterprise-grade, AI-powered autonomous marine intelligence and mission control platform. It provides real-time ocean telemetry monitoring, machine-learning-driven water quality anomaly detection, 6-hour pollution drift trajectory forecasting, computer vision marine species classification, and autonomous drone fleet dispatch.

---

## Key Features

### 1. ML Water Quality Anomaly Detector & Chemical Spill Simulator
- **Algorithm**: Scikit-Learn **Isolation Forest** unsupervised anomaly detector.
- **Interactive Scenarios**: Clean Ocean Baseline & Chemical Spill Simulation.
- **Instant Response**: Automated critical alerts and 1-click Drone Dispatch.

### 2. Autonomous Drone Fleet Dispatch
- **Mission Control**: Tracks active drone units across sectors.
- **Emergency Dispatch**: Computes nearest available drone route, ETA, and streams telemetry.

### 3. Pollution Spread & 6-Hour Trajectory Forecast
- **Method**: **Ridge Polynomial Regression** — a real trained ML model (not a heuristic).
- **Visual Trajectory**: Renders hour-by-hour (+1h to +6h) projected severity progression curves.

### 4. Marine Species Computer Vision Classifier
- **Model**: Transfer-learned **MobileNetV3-Small** (ImageNet-pretrained, 224×224).
- **Interactive Vision UI**: Drag-and-drop or file upload with 1-click test presets.

### 5. Interactive Ocean Monitoring Map
- **Leaflet & OpenStreetMap**: Multi-layered geospatial visualization.

### 6. Ecosystem Time Machine
- Project ecosystem health across 1 Month, 6 Months, 1 Year, and 5 Year horizons.

### 7. AI Ocean Assistant
- Natural-language marine assistant for sensor health, pollution statistics, and emergency protocols.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 15 + React 19)             │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │Dashboard │  │Ocean Map │  │Species   │  │Drone     │           │
│  │(Zustand) │  │(Leaflet) │  │Classifier│  │Command   │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       └──────────────┴──────────────┴──────────────┘                │
│                              │                                      │
│                    SSE / REST API calls                              │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    BACKEND (Express + TypeScript)                    │
│                              │                                      │
│  ┌───────────────────────────┼───────────────────────────┐          │
│  │                           ▼                           │          │
│  │  ┌─────────┐    ┌──────────────┐    ┌─────────────┐  │          │
│  │  │EventBus │───▶│  ML Worker   │───▶│  SSE Push   │  │          │
│  │  │(Queue)  │    │  (RAM model) │    │  (Live UI)  │  │          │
│  │  └─────────┘    └──────────────┘    └─────────────┘  │          │
│  │        │                                              │          │
│  │        ▼                                              │          │
│  │  ┌──────────────┐                                     │          │
│  │  │ SQLite (WAL) │                                     │          │
│  │  │ Telemetry DB │                                     │          │
│  │  └──────────────┘                                     │          │
│  └───────────────────────────────────────────────────────┘          │
│                              │                                      │
│                    Python child_process                              │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────────────┐
│                    ML ENGINE (Python 3.9+)                           │
│                              │                                      │
│  ┌───────────────────┐  ┌────────────────┐  ┌──────────────────┐   │
│  │ Isolation Forest  │  │ MobileNetV3    │  │ Ridge Polynomial │   │
│  │ (anomaly_model.pkl│  │ (species_      │  │ Regression       │   │
│  │ → Water Anomaly   │  │  classifier.pt)│  │ (forecast_       │   │
│  │   Detection       │  │ → Species CV   │  │  spread.py)      │   │
│  └───────────────────┘  └────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15.1 (App Router), React 19
- **Styling**: Tailwind CSS, Vanilla CSS animations, Glassmorphism design tokens
- **State Management**: Zustand (App Store, Auth Store, Alerts Store)
- **Icons & UI**: Lucide React, Framer Motion
- **Maps**: Leaflet, React-Leaflet, CartoDB Dark Matter basemaps

### Backend
- **Runtime**: Node.js v20+, Express
- **Language**: TypeScript (`tsx` watcher)
- **Database**: SQLite (`better-sqlite3`) for persistent missions, telemetry, and alerts
- **Inter-Process Communication**: Node.js `child_process` execution of Python ML subroutines
- **Validation**: Zod schema validation on all API inputs
- **Auth**: JWT-based session auth + API key support
- **Rate Limiting**: In-memory rate limiter (100 req/min per IP)

### Machine Learning & Data Science
- **Environment**: Python 3.9+
- **Libraries**: Scikit-Learn, NumPy, Pandas, Pillow (PIL), Joblib, PyTorch, torchvision
- **Pre-trained Models**:
  - `ml/anomaly_model.pkl`: Isolation Forest for multi-dimensional water quality telemetry
  - `ml/species_classifier.pt`: Transfer-learned MobileNetV3-Small marine life classifier (~72.6% validation accuracy)

---

## API Reference

### 1. Water Quality Anomaly Detection
```
POST /api/sensors/predict
Content-Type: application/json

{
  "temperature": 3.1,
  "ph": 6.5,
  "salinity": 34.5,
  "oxygen": 2.1,
  "turbidity": 12.0
}
```

### 2. Pollution Spread Forecast
```
POST /api/pollution/forecast
Content-Type: application/json

{
  "severity": 7.5,
  "trend": "increasing",
  "name": "Chemical Spill Event"
}
```

### 3. Marine Species Image Classification
```
POST /api/species/classify
Content-Type: application/json

{
  "image_b64": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

### 4. Dashboard Overview (Real Data)
```
GET /api/dashboard/overview
```

---

## Project Directory Structure

```
DeepSea/
├── backend/
│   ├── src/
│   │   ├── db/               # SQLite database client and schemas
│   │   ├── lib/              # EventBus, ML Worker, SSE, validation, auth, rate limiting
│   │   │   └── pipeline/     # Split pipeline modules (Consumer, Dispatcher, Inspector)
│   │   ├── routes/           # REST endpoints (sensors, pollution, species, drones, alerts, etc.)
│   │   └── server.ts         # Express server entrypoint
│   └── package.json
├── frontend/
│   ├── public/               # Static assets, logos, and sample species images
│   ├── src/
│   │   ├── app/              # Next.js App Router (dashboard, species, map, drones, alerts, etc.)
│   │   ├── components/       # UI design system & AI capability cards
│   │   ├── hooks/            # Custom React hooks (SSE, polling, live KPIs)
│   │   ├── lib/              # Utilities, SEO, rate-limiting, and stores
│   │   └── store/            # Zustand global application state stores
│   └── package.json
├── ml/
│   ├── anomaly_model.pkl             # Trained Isolation Forest model
│   ├── species_classifier.pt         # Transfer-learned MobileNetV3 vision model
│   ├── species_classifier.pkl        # Legacy scikit-learn model (fallback)
│   ├── species_classifier_metrics.json # Validation accuracy + per-class report
│   ├── species_label_map.json        # Kaggle class -> app species mapping
│   ├── requirements.txt              # Python dependencies
│   ├── ocean_sensor_data.csv         # Physical-chemical training dataset
│   ├── predict.py                    # Anomaly detector execution script
│   ├── predict_server.py             # Resident anomaly inference server
│   ├── forecast_spread.py            # Ridge regression 6-hour forecast
│   ├── classify_species.py           # Species CV classification (one-shot)
│   ├── classify_species_server.py    # Resident species inference server
│   └── train_*.py                    # Training scripts
├── .github/workflows/ci.yml        # GitHub Actions CI pipeline
├── docker-compose.yml                # One-command Docker setup
├── backend/Dockerfile                # Backend container
├── frontend/Dockerfile               # Frontend container
├── .env.example                      # Environment template
└── package.json                      # Workspace scripts
```

---

## Getting Started

### Prerequisites
- **Node.js**: `v18.x` or `v20.x+`
- **Python**: `3.9+` with `pip`
- **Git**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tiwariraman884/DeepSee.git
   cd DeepSee
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

3. **Install Python ML dependencies**:
   ```bash
   pip install numpy pandas scikit-learn pillow joblib
   ```

4. **Setup Environment Variables**:
   ```bash
   cp .env.example .env
   ```

### Running the Development Environment

Start the frontend and backend dev servers in **separate terminals**:

```bash
npm run dev:frontend   # Next.js dashboard  → http://localhost:3000
npm run dev:backend    # Express API + SSE → http://localhost:5000
```

### Docker (One-Command Setup)

```bash
docker-compose up --build
```

This starts both the backend (port 5000) and frontend (port 3000) in containers.

### Running Tests

```bash
# Backend tests (34+ tests incl. the full anomaly → dispatch → inspection E2E)
npm --prefix backend test

# Frontend typecheck
npm --prefix frontend run typecheck

# Frontend lint
npm --prefix frontend run lint
```

### CI/CD

The project includes a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every push and PR:
- Backend: typecheck + tests
- Frontend: typecheck + lint + build
- ML: Python syntax validation

---

## Security & Best Practices

- **Authentication**: JWT-based session auth with httpOnly cookies + API key support
- **Input Validation**: Zod schemas validate every API request
- **Rate Limiting**: 100 requests per minute per IP
- **Zero Secret Exposure**: `.env` files and sensitive SQLite database files are strictly ignored via `.gitignore`
- **Input Sanitization**: Python execution scripts feature regex-based and schema-validated payload parsers
- **Error Handling**: Graceful degradation throughout — ML worker falls back to one-shot, classifier falls back to legacy `.pkl`

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.
