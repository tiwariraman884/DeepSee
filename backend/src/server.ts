import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";

// Load environment variables (from backend root)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5000;

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve the beautiful static HTML page for the root
app.use(express.static(path.join(__dirname, "../public")));


import authRoutes from "./routes/auth";
import dashboardRoutes from "./routes/dashboard";
import analyticsRoutes from "./routes/analytics";
import dronesRoutes from "./routes/drones";
import pollutionRoutes from "./routes/pollution";
import speciesRoutes from "./routes/species";
import sensorsRoutes from "./routes/sensors";
import missionsRoutes from "./routes/missions";
import reportsRoutes from "./routes/reports";
import settingsRoutes from "./routes/settings";
import alertsRoutes from "./routes/alerts";

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/drones", dronesRoutes);
app.use("/api/pollution", pollutionRoutes);
app.use("/api/species", speciesRoutes);
app.use("/api/sensors", sensorsRoutes);
app.use("/api/missions", missionsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/alerts", alertsRoutes);

app.listen(PORT, () => {

  console.log(`Backend server running on http://localhost:${PORT}`);
});
