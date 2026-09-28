FROM node:20-bookworm

# Install Python and ML dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy ML scripts and install Python deps
COPY ml/ ./ml/
RUN pip3 install --break-system-packages -r ml/requirements.txt || pip3 install --break-system-packages numpy pandas scikit-learn pillow joblib

# Copy backend source
COPY backend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY backend/ ./backend/
COPY .env.example ./.env

EXPOSE 5000

CMD ["npx", "tsx", "backend/src/server.ts"]
