/**
 * DeepSea SSE (Server-Sent Events) Manager
 * ==========================================
 * Ye WebSocket ka simpler alternative hai — server se client ki taraf
 * ek-direction mein real-time data push karna.
 *
 * Sensor se data aata hai → ML detect karta hai → SSE se dashboard update hota hai
 * Total latency: typically < 50ms end-to-end
 *
 * Production mein ye Redis Pub/Sub ya Socket.io se replace ho sakta hai
 * for multi-server scaling (horizontal scaling ke liye).
 */

import type { Response } from "express";

export interface SSEClient {
  id: string;
  res: Response;
  connectedAt: Date;
  lastPing: Date;
}

class SSEManager {
  private clients = new Map<string, SSEClient>();
  private clientCounter = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Send heartbeat every 15s to keep connections alive (prevents nginx timeout)
    this.heartbeatInterval = setInterval(() => {
      this.broadcast("heartbeat", { ts: new Date().toISOString(), clients: this.clients.size });
    }, 15000);
  }

  /** Register a new SSE client */
  addClient(res: Response): string {
    const id = `sse-${++this.clientCounter}-${Date.now()}`;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");   // Nginx buffering off karo
    res.flushHeaders();

    const client: SSEClient = { id, res, connectedAt: new Date(), lastPing: new Date() };
    this.clients.set(id, client);

    console.log(`[SSE] Client connected: ${id} (total: ${this.clients.size})`);

    // Send initial connection event
    this.sendToClient(client, "connected", {
      clientId: id,
      message: "DeepSea Guardian real-time stream connected",
      ts: new Date().toISOString(),
    });

    return id;
  }

  /** Remove a client (called on connection close) */
  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id} (remaining: ${this.clients.size})`);
  }

  /** Send event to a specific client */
  private sendToClient(client: SSEClient, event: string, data: unknown): void {
    try {
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      client.lastPing = new Date();
    } catch {
      // Client disconnected mid-write — remove them
      this.clients.delete(client.id);
    }
  }

  /** Broadcast event to ALL connected clients (like Redis PUBLISH) */
  broadcast(event: string, data: unknown): void {
    if (this.clients.size === 0) return;

    const deadClients: string[] = [];

    for (const [id, client] of this.clients) {
      try {
        client.res.write(`event: ${event}\n`);
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        client.lastPing = new Date();
      } catch {
        deadClients.push(id);
      }
    }

    // Clean up dead connections
    for (const id of deadClients) {
      this.clients.delete(id);
    }
  }

  /** Get manager statistics */
  getStats() {
    return {
      activeClients: this.clients.size,
      clients: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        connectedAt: c.connectedAt,
        lastPing: c.lastPing,
      })),
    };
  }
}

// Singleton — ek hi instance pure server mein
export const sseManager = new SSEManager();
export default sseManager;
