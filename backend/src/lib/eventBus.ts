/**
 * DeepSea In-Memory Event Bus
 * ============================
 * Ye Redis Pub/Sub ya Apache Kafka ka MVP-level simulation hai.
 *
 * Production mein yahan Redis client ya Kafka consumer/producer hoga.
 * Abhi ke liye Node.js EventEmitter ko use karte hain jo same interface
 * provide karta hai — sirf ek line change se production me swap ho sakta hai.
 *
 * Topics (Kafka channels ki tarah):
 *   "sensor.reading"   → Sensor se raw data aaya
 *   "ml.anomaly"       → ML ne anomaly detect ki
 *   "alert.new"        → Naya alert create hua
 *   "drone.dispatch"   → Drone ko kisi jagah bhejna hai
 *   "sse.broadcast"    → SSE clients ko push karo
 */

import { EventEmitter } from "events";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SensorReadingEvent {
  sensorId: string;
  sensorName: string;
  temperature?: number;
  ph?: number;
  salinity?: number;
  oxygen?: number;
  turbidity?: number;
  timestamp: string;
}

export interface AnomalyEvent {
  sensorId: string;
  sensorName: string;
  isAnomaly: boolean;
  score: number;
  latency_ms: number;
  reading: SensorReadingEvent;
  timestamp: string;
}

export interface AlertEvent {
  id: string;
  type: "critical" | "warning" | "info";
  message: string;
  location: string;
  category: string;
  timestamp: string;
}

export interface SSEMessage {
  event: string;   // "sensor_update" | "anomaly_alert" | "drone_dispatch" | "heartbeat"
  data: unknown;
}

// ─── Topic names (Kafka topic names ki tarah) ─────────────────────────────────
export const TOPICS = {
  SENSOR_READING:  "sensor.reading",
  ML_ANOMALY:      "ml.anomaly",
  ALERT_NEW:       "alert.new",
  DRONE_DISPATCH:  "drone.dispatch",
  SSE_BROADCAST:   "sse.broadcast",
} as const;

// ─── The Bus ──────────────────────────────────────────────────────────────────
class EventBus extends EventEmitter {
  private stats = {
    published: 0,
    consumed: 0,
    topics: {} as Record<string, number>,
  };

  /** Publish a message to a topic (like Kafka producer.send()) */
  publish<T>(topic: string, payload: T): void {
    this.stats.published++;
    this.stats.topics[topic] = (this.stats.topics[topic] || 0) + 1;
    this.emit(topic, payload);
  }

  /** Subscribe to a topic (like Kafka consumer.subscribe()) */
  subscribe<T>(topic: string, handler: (payload: T) => void): () => void {
    this.stats.consumed++;
    this.on(topic, handler);
    // Returns an unsubscribe function
    return () => this.off(topic, handler);
  }

  /** Get bus statistics */
  getStats() {
    return { ...this.stats, listenerCounts: this.eventNames().reduce((acc, ev) => {
      acc[ev as string] = this.listenerCount(ev as string);
      return acc;
    }, {} as Record<string, number>) };
  }
}

// Singleton — ek hi instance pure application mein
export const eventBus = new EventBus();
// Node.js default max listener warning remove karo (kyunki bohot saare SSE clients ho sakte hain)
eventBus.setMaxListeners(200);

export default eventBus;
