// ─────────────────────────────────────────────────────────────────────────────
// Canonical data models — single source of truth (aligned to 23_Data_Models.md).
// Fields marked as extensions are kept additive; the core shape follows Doc 23.
// ─────────────────────────────────────────────────────────────────────────────

export type Coordinates = { lat: number; lng: number };

export type Severity = "low" | "medium" | "high" | "critical"; // categorical (extension: threat/severity metadata)

export type PollutionType =
  | "plastic"
  | "oil_spill"
  | "chemical"
  | "ghost_net"
  | "illegal_dumping";

export interface PollutionEvent {
  id: string; // prefix: poll_
  name: string;
  type: PollutionType;
  latitude: number;
  longitude: number;
  severity: number; // 1-10
  concentration: number; // ppm / index (extension)
  affectedArea: number; // km2 (extension)
  region: string;
  detectedAt: string;
  trend: "increasing" | "stable" | "decreasing"; // extension
  status: "active" | "responding" | "resolved";
}

export type SpeciesStatus =
  | "least_concern"
  | "near_threatened"
  | "vulnerable"
  | "endangered"
  | "critically_endangered";

export type SpeciesCategory = "fish" | "coral" | "mammal" | "reptile";
export type SpeciesConservation = "endangered" | "vulnerable" | "stable";

export interface Species {
  id: string; // prefix: sp_
  name: string;
  scientificName: string; // extension
  status: SpeciesStatus;
  category: SpeciesCategory;
  conservation: SpeciesConservation; // Doc 23 status
  image?: string; // local/remote species photo (extension: imagery)
  population: number[]; // 5 yearly points, oldest → newest
  populationTrend: "increasing" | "stable" | "decreasing"; // extension
  habitat: string; // extension
  region: string;
  conservationProgress: number; // 0-100 (extension)
  threatLevel: Severity; // extension
  threats: string[]; // Doc 23
  coordinates: { lat: number; lng: number }; // extension (map rendering)
}

export type DroneStatus = "active" | "returning" | "charging" | "idle" | "offline";

export interface Drone {
  id: string; // prefix: drone_
  name: string;
  status: DroneStatus;
  battery: number; // 0-100
  position: { lat: number; lng: number };
  depth: number; // meters
  speed: number; // knots
  region: string;
  lastUpdate: string;
  currentMission: string | null;
}

export type AlertType = "critical" | "warning" | "info";

export interface Alert {
  id: string; // prefix: alert_
  type: AlertType;
  message: string; // merged title + description
  location: string;
  timestamp: string;
  read: boolean; // Doc 23 semantics (user seen), distinct from resolved
  resolved: boolean; // extension (underlying issue status)
  category: string;
  relatedEntity?: string; // FK to poll_ / sp_ / drone_ id
}

export type SensorType =
  | "temperature"
  | "salinity"
  | "oxygen"
  | "ph"
  | "turbidity"
  | "pollution";

export interface Sensor {
  id: string; // prefix: sensor_
  name: string;
  type: SensorType;
  coordinates: { lat: number; lng: number };
  online: boolean;
  lastReading: {
    ph?: number;
    temp?: number;
    salinity?: number;
    oxygen?: number;
    turbidity?: number;
  };
  status: "online" | "offline" | "maintenance"; // extension
  updatedAt: string;
}

export type MissionStatus = "active" | "completed" | "scheduled" | "aborted";

export interface Mission {
  id: string; // prefix: mission_
  droneId: string; // FK to drone_
  droneName: string;
  name: string;
  status: MissionStatus;
  progress: number; // 0-100
  route: { lat: number; lng: number }[];
  startedAt: string;
  objective: string;
  coverage: number; // km2
}

export interface OceanHealthScore {
  overall: number; // 0-100, weighted composite (derived)
  pollution: number; // 0-100
  biodiversity: number; // 0-100
  waterQuality: number; // 0-100
  coralHealth: number; // 0-100
}

export type TimeHorizon = "today" | "1m" | "6m" | "1y" | "5y";

export interface RiskPrediction {
  category: "coral_bleaching" | "biodiversity_loss" | "pollution_expansion" | "illegal_fishing";
  region: string;
  score: number; // 0-100
  confidence: number; // 0-100
  horizon: TimeHorizon;
  narrative: string;
}

export interface TimeSeriesPoint {
  label: string;
  pollution: number;
  biodiversity: number;
  waterQuality: number;
}
