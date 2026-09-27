# DeepSea Guardian (DeepSee) 🌊🤖

> **AI-Powered Autonomous Ocean Ecosystem Monitoring & Mission Control Platform**

DeepSea Guardian is an end-to-end intelligent marine intelligence platform designed to monitor deep-sea water quality, detect pollution anomalies with machine learning, forecast 6-hour pollution drift trajectories, classify marine biodiversity using computer vision, and orchestrate autonomous drone response fleets.

---

## 🌟 Key Features

### 1. 🧠 Live ML-Powered Water Quality Anomaly Detection
- **Model**: Scikit-learn **Isolation Forest** trained on marine physical-chemical telemetry (pH, Turbidity, Dissolved Oxygen, Salinity, Temperature).
- **Interactive Scenarios**: Instant Clean Ocean baseline testing & 1-click **Chemical Spill Simulation**.
- **Real-Time Alerting**: Dispatches automated critical alerts across the system mesh upon detecting anomalous water states.

### 2. 🚁 Autonomous Drone Fleet Dispatch
- **Live Response Dispatch**: Automatically activates nearest available autonomous underwater drone (e.g., `AquaDrone-Alpha`) with real-time ETA calculations and telemetry streaming upon anomaly verification.

### 3. 📈 AI Pollution Spread & Trajectory Forecast
- **Model**: Polynomial & dynamic non-linear trend model for projecting next 6 hours of pollution drift and severity progression (+1h to +6h).

### 4. 🐟 Computer Vision Marine Species Classifier
- **Model**: Multi-channel color histogram + spatial pixel feature classifier for identifying vulnerable marine species (e.g., Hawksbill Turtle, Blue Whale, Clownfish, Hammerhead Shark, Dolphins).
- **Interactive Vision**: Drag-and-drop fish photo upload + 1-click test marine sample feeds with real-time confidence scores.

### 5. 🗺️ Real-Time Ocean Monitoring Map & Mission Control Dashboard
- Interactive geospatial map tracking pollution hotspots, drone telemetry, and sensor clusters.
- Real-time KPI telemetry (Ocean Health Index, Active Drones, Hotspot counters).
- Time Machine projection engine for modeling ocean health across 1-month to 5-year horizons.

---

## 🛠️ Architecture & Tech Stack

```
DeepSea/
├── frontend/       # Next.js 15 (App Router), React 19, Tailwind CSS, Leaflet, Framer Motion, Zustand
├── backend/        # Node.js, Express, TypeScript, SQLite / Better-SQLite3, WebSocket / Polling Mesh
└── ml/             # Python (Scikit-Learn, Pandas, NumPy, Pillow, Joblib)
```

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, Leaflet Maps.
- **Backend**: Node.js, Express, TypeScript, SQLite (`better-sqlite3`), Child Process ML pipeline integration.
- **Machine Learning**: Python 3, Scikit-Learn (Isolation Forest, Logistic Regression, Feature Extractors), NumPy, Pandas, Pillow.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **Python**: v3.9+ with `pip`
- **npm** or **yarn** / **pnpm**

### 2. Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/tiwariraman884/DeepSee.git
   cd DeepSee
   ```

2. **Install Root, Frontend & Backend Dependencies**:
   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

3. **Install Python ML Dependencies**:
   ```bash
   pip install numpy pandas scikit-learn pillow joblib
   ```

### 3. Running the Platform

To start both the Frontend, Backend, and Live Telemetry simultaneously:

```bash
npm run dev
```

- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## 🔒 Confidentiality & Security
Sensitive credentials and local database storage (`.env`, `.env.local`, `.data/`, SQLite databases) are excluded from the repository. Use `.env.example` to configure custom environment variables.

---

## 📄 License
MIT License. Developed for Marine Ecosystem Conservation and Advanced Deep-Sea Autonomous Intelligence.
