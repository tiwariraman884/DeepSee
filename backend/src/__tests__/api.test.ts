import request from "supertest";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// ── Build a minimal Express app for testing ──────────────────────────────────
// (avoids starting the actual server on a port)
import authRoutes from "../routes/auth";
import sensorsRoutes from "../routes/sensors";
import pollutionRoutes from "../routes/pollution";
import dashboardRoutes from "../routes/dashboard";
import dronesRoutes from "../routes/drones";

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/sensors", sensorsRoutes);
app.use("/api/pollution", pollutionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/drones", dronesRoutes);

// ── HEALTH ───────────────────────────────────────────────────────────────────
describe("GET /api/health", () => {
  it("returns status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

// ── AUTH ─────────────────────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("rejects missing credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@deepsea.io", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("logs in successfully with admin credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@deepsea.io", password: "DeepSea2026!" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe("admin@deepsea.io");
    expect(res.body.user.role).toBe("admin");
  });
});

// ── SENSORS ──────────────────────────────────────────────────────────────────
describe("GET /api/sensors", () => {
  it("returns sensors array", async () => {
    const res = await request(app).get("/api/sensors");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sensors)).toBe(true);
  });
});

describe("POST /api/sensors/predict", () => {
  it("returns Normal for clean ocean data", async () => {
    const res = await request(app)
      .post("/api/sensors/predict")
      .send({ temperature: 3.1, ph: 8.05, salinity: 34.5, oxygen: 5.2, turbidity: 0.4 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.isAnomaly).toBe(false);
  });

  it("returns Anomaly for chemical spill data", async () => {
    const res = await request(app)
      .post("/api/sensors/predict")
      .send({ temperature: 3.1, ph: 6.5, salinity: 34.5, oxygen: 2.1, turbidity: 12.0 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.isAnomaly).toBe(true);
  });

  it("returns 400 if fields are missing", async () => {
    const res = await request(app)
      .post("/api/sensors/predict")
      .send({ temperature: 3.1 }); // missing ph, salinity, oxygen, turbidity
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
  });
});

// ── POLLUTION ────────────────────────────────────────────────────────────────
describe("GET /api/pollution", () => {
  it("returns pollution events array", async () => {
    const res = await request(app).get("/api/pollution");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.pollution)).toBe(true);
  });
});

// ── DRONES ───────────────────────────────────────────────────────────────────
describe("GET /api/drones", () => {
  it("returns drones array", async () => {
    const res = await request(app).get("/api/drones");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.drones)).toBe(true);
  });
});
