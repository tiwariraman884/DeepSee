"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { type AssistantMessage, type AssistantChartData } from "@/features/ai-assistant/assistant";
import { ChatBubble } from "@/components/domain/ChatBubble";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";

const suggestions = [
  "Why is this area high risk?",
  "Show pollution trends",
  "Which species are endangered?",
  "What is the ocean health index?",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello, I'm the DeepSea Guardian AI assistant. Ask me about pollution, biodiversity, alerts, drones, or ocean health.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [erroredQuery, setErroredQuery] = useState<string | null>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    const typingMsg: AssistantMessage = {
      id: `b-${Date.now()}`,
      role: "assistant",
      content: "…",
      timestamp: Date.now(),
    };
    setMessages((m) => [...m, userMsg, typingMsg]);
    setInput("");
    setPending(true);
    setErroredQuery(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setMessages((m) =>
        m.map((msg) =>
          msg.id === typingMsg.id
            ? {
                ...typingMsg,
                content: data.answer,
                chartData: data.chartData as AssistantChartData | undefined,
              }
            : msg
        )
      );
    } catch {
      setMessages((m) => m.filter((msg) => msg.id !== typingMsg.id));
      setErroredQuery(trimmed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-[560px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-1" role="log" aria-live="polite" aria-label="Assistant conversation">
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} content={m.content} chartData={m.chartData} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            disabled={pending}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-muted transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {s}
          </button>
        ))}
        </div>
        {erroredQuery && (
          <ErrorState
            onRetry={() => {
              setErroredQuery(null);
              send(erroredQuery);
            }}
          />
        )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          placeholder="Ask about the ocean..."
          aria-label="Ask the assistant about the ocean"
          className="flex-1 rounded-control border border-white/10 bg-secondary px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-accent disabled:opacity-50"
        />
        <Button type="submit" size="md" loading={pending} aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
