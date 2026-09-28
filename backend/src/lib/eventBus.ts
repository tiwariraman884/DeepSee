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
 *
 * Improvements over the basic EventEmitter:
 *   - Dead-letter queue for failed deliveries
 *   - Retry with exponential backoff
 *   - Delivery tracking (published / delivered / failed)
 *   - Backpressure-aware (max queue size)
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
  event: string;
  data: unknown;
}

export interface QueuedMessage<T = any> {
  id: string;
  topic: string;
  payload: T;
  publishedAt: number;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
}

export interface BusStats {
  published: number;
  delivered: number;
  failed: number;
  retried: number;
  deadLettered: number;
  queueSize: number;
  topics: Record<string, number>;
  listenerCounts: Record<string, number>;
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
const MAX_QUEUE_SIZE = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

class EventBus extends EventEmitter {
  private stats = {
    published: 0,
    delivered: 0,
    failed: 0,
    retried: 0,
    deadLettered: 0,
    topics: {} as Record<string, number>,
  };

  private queue: QueuedMessage[] = [];
  private deadLetterQueue: QueuedMessage[] = [];
  private processing = false;
  private msgCounter = 0;

  /** Publish a message to a topic (like Kafka producer.send()) */
  publish<T>(topic: string, payload: T): string {
    const id: string = `msg-${++this.msgCounter}-${Date.now()}`;

    this.stats.published++;
    this.stats.topics[topic] = (this.stats.topics[topic] || 0) + 1;

    const queued: QueuedMessage<T> = {
      id,
      topic,
      payload,
      publishedAt: Date.now(),
      attempts: 0,
      maxAttempts: MAX_RETRIES,
    };

    // Backpressure: drop oldest if queue is full
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      const dropped = this.queue.shift();
      if (dropped) {
        this.stats.deadLettered++;
        this.deadLetterQueue.push(dropped);
        console.warn(`[EventBus] Queue full — dropped message ${dropped.id}`);
      }
    }

    this.queue.push(queued);
    this.processQueue();

    // Also emit immediately for synchronous listeners
    this.emit(topic, payload);

    return id;
  }

  /** Subscribe to a topic (like Kafka consumer.subscribe()) */
  subscribe<T>(topic: string, handler: (payload: T) => void): () => void {
    this.on(topic, handler);
    return () => this.off(topic, handler);
  }

  /** Get bus statistics */
  getStats(): BusStats {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      listenerCounts: this.eventNames().reduce((acc, ev) => {
        acc[ev as string] = this.listenerCount(ev as string);
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /** Get dead letter queue for inspection */
  getDeadLetterQueue(): QueuedMessage[] {
    return [...this.deadLetterQueue];
  }

  /** Retry all dead-lettered messages */
  retryDeadLetters(): void {
    const toRetry = [...this.deadLetterQueue];
    this.deadLetterQueue = [];
    for (const msg of toRetry) {
      msg.attempts = 0;
      msg.lastError = undefined;
      this.queue.push(msg);
    }
    this.processQueue();
  }

  /** Clear all queues (for testing) */
  clear(): void {
    this.queue = [];
    this.deadLetterQueue = [];
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const msg = this.queue.shift()!;
      msg.attempts++;

      try {
        // Emit to all listeners — if any throws, we retry
        const listeners = this.listeners(msg.topic);
        for (const listener of listeners) {
          try {
            (listener as Function)(msg.payload);
          } catch (err: any) {
            throw err;
          }
        }
        this.stats.delivered++;
      } catch (err: any) {
        msg.lastError = err.message;
        if (msg.attempts < msg.maxAttempts) {
          this.stats.retried++;
          const delay = RETRY_DELAY_MS * msg.attempts;
          console.warn(`[EventBus] Retry ${msg.attempts}/${msg.maxAttempts} for ${msg.id} in ${delay}ms: ${err.message}`);
          setTimeout(() => {
            this.queue.push(msg);
          }, delay);
        } else {
          this.stats.deadLettered++;
          this.deadLetterQueue.push(msg);
          console.error(`[EventBus] Message ${msg.id} dead-lettered after ${msg.attempts} attempts: ${err.message}`);
        }
      }
    }

    this.processing = false;
  }
}

// Singleton — ek hi instance pure application mein
export const eventBus = new EventBus();
eventBus.setMaxListeners(200);

export default eventBus;
