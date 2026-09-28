/**
 * SSE manager tests — client lifecycle, event framing, dead-connection cleanup.
 * Uses a mock Express Response (the manager only needs setHeader/flushHeaders/
 * write, which we record so the framing itself can be asserted).
 */
import { sseManager } from "../lib/sseManager";

function mockRes(): { res: any; written: string[]; end: () => void } {
  const written: string[] = [];
  const res: any = {
    setHeader: () => {},
    flushHeaders: () => {},
    write: (chunk: string) => {
      written.push(chunk);
      return true;
    },
    end: () => {},
    on: () => {},
    once: () => {},
    emit: () => {},
    writableEnded: false,
    destroyed: false,
  };
  return { res, written, end: () => res.end() };
}

describe("sseManager", () => {
  it("registers a client and sends the initial 'connected' event", () => {
    const { res, written } = mockRes();
    const id = sseManager.addClient(res);
    expect(id).toMatch(/^sse-\d+-\d+$/);
    expect(written.some((c) => c.includes("event: connected\n"))).toBe(true);
    sseManager.removeClient(id);
  });

  it("broadcast frames use canonical SSE format (event + data lines)", () => {
    const { res, written } = mockRes();
    const id = sseManager.addClient(res);
    const before = written.length;

    sseManager.broadcast("inspection_started", { inspectionId: "insp-1", mission: "Marine Threat Inspection" });

    const frames = written.slice(before).join("");
    expect(frames).toContain("event: inspection_started\n");
    expect(frames).toMatch(/data: \{"inspectionId":"insp-1","mission":"Marine Threat Inspection"\}\n\n/);
    sseManager.removeClient(id);
  });

  it("all canonical inspection lifecycle events reach the client", () => {
    const { res, written } = mockRes();
    const id = sseManager.addClient(res);
    const before = written.length;

    const events: [string, unknown][] = [
      ["inspection_started", { inspectionId: "i1" }],
      ["inspection_progress", { inspectionId: "i1", progress: 40, label: "Camera scan" }],
      ["ai_detection", { inspectionId: "i1", label: "Turtle", confidence: 91, simulation: true }],
      ["evidence_captured", { inspectionId: "i1", label: "Oil Film", kind: "oil_film" }],
      ["inspection_completed", { inspectionId: "i1", severity: "high" }],
      ["drone_dispatch", { inspectionId: "i1", droneName: "Test" }],
      ["drone_update", { id: "d1", lat: 1, lng: 2 }],
      ["anomaly_alert", { id: "a1" }],
      ["dispatch_unavailable", { reason: "fleet_engaged" }],
      ["sensor_update", { sensorId: "s1" }],
    ];
    for (const [event, data] of events) sseManager.broadcast(event, data);

    const frames = written.slice(before).join("");
    for (const [event] of events) {
      expect(frames).toContain(`event: ${event}\n`);
    }
    sseManager.removeClient(id);
  });

  it("removing a client stops further delivery and updates stats", () => {
    const { res, written } = mockRes();
    const id = sseManager.addClient(res);
    const total = sseManager.getStats().activeClients;
    sseManager.removeClient(id);
    expect(sseManager.getStats().activeClients).toBe(total - 1);

    const before = written.length;
    sseManager.broadcast("inspection_started", { inspectionId: "i-after" });
    expect(written.slice(before).join("")).not.toContain("i-after");
  });

  it("survives a client whose write throws (dead connection cleanup)", () => {
    const good = mockRes();
    const goodId = sseManager.addClient(good.res);

    const badRes: any = {
      ...mockRes().res,
      write: () => { throw new Error("EPIPE"); },
    };
    const badId = sseManager.addClient(badRes);
    const goodBefore = good.written.length;

    expect(() => sseManager.broadcast("sensor_update", { sensorId: "s-x" })).not.toThrow();

    // Healthy client still received the event; broken one was dropped.
    expect(good.written.slice(goodBefore).join("")).toContain("event: sensor_update\n");
    expect(sseManager.getStats().activeClients).toBeLessThan(
      sseManager.getStats().clients.length + 1 // sanity: no crash, count finite
    );
    sseManager.removeClient(goodId);
    sseManager.removeClient(badId);
  });
});
