/**
 * Centralized Zod validation schemas for all API inputs.
 * Every route validates its input through these schemas — no garbage reaches
 * the ML models or the database.
 */
import { z } from "zod";

// ─── Sensor Predict ───────────────────────────────────────────────────────────
export const sensorPredictSchema = z.object({
  temperature: z.number().min(-5).max(50).describe("Water temperature in Celsius"),
  ph: z.number().min(0).max(14).describe("pH level (0-14)"),
  salinity: z.number().min(0).max(50).describe("Salinity in PSU"),
  oxygen: z.number().min(0).max(20).describe("Dissolved oxygen in mg/L"),
  turbidity: z.number().min(0).max(1000).describe("Turbidity in NTU"),
});

// ─── Sensor Ingest ────────────────────────────────────────────────────────────
export const sensorIngestSchema = z.object({
  sensorId: z.string().min(1).max(100),
  sensorName: z.string().min(1).max(200).optional(),
  temperature: z.number().min(-5).max(50).optional(),
  ph: z.number().min(0).max(14).optional(),
  salinity: z.number().min(0).max(50).optional(),
  oxygen: z.number().min(0).max(20).optional(),
  turbidity: z.number().min(0).max(1000).optional(),
});

// ─── Pollution Forecast ───────────────────────────────────────────────────────
export const pollutionForecastSchema = z.object({
  severity: z.number().min(1).max(10),
  trend: z.enum(["increasing", "stable", "decreasing"]),
  name: z.string().min(1).max(200).default("Pollution Event"),
});

// ─── Species Classify ─────────────────────────────────────────────────────────
export const speciesClassifySchema = z.object({
  image_b64: z.string().min(100).max(10_000_000),
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const signupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsPatchSchema = z.object({
  profile: z.object({
    fullName: z.string().max(100).optional(),
    email: z.string().email().optional(),
    organization: z.string().max(200).optional(),
    avatar: z.string().max(500).optional(),
  }).optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
  region: z.string().max(100).optional(),
  theme: z.enum(["dark", "light"]).optional(),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────
export type SensorPredictInput = z.infer<typeof sensorPredictSchema>;
export type SensorIngestInput = z.infer<typeof sensorIngestSchema>;
export type PollutionForecastInput = z.infer<typeof pollutionForecastSchema>;
export type SpeciesClassifyInput = z.infer<typeof speciesClassifySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
