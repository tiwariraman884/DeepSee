"use client";

import { useState } from "react";
import { Bot, X, Send, MessageSquare } from "lucide-react";
import { type AssistantMessage } from "@/features/ai-assistant/assistant";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

const suggestions = [
  "Why is this area high risk?",
  "Show pollution trends",
  "Which species are endangered?",
];

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hi, I'm the DeepSea Guardian AI. Ask me about pollution, species, alerts or ocean health.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const { error: toastError } = useToast();

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
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error("request failed");
      const data = await res.json();
      setMessages((m) =>
        m.map((msg) => (msg.id === typingMsg.id ? { ...typingMsg, content: data.answer } : msg))
      );
    } catch {
      setMessages((m) => m.filter((msg) => msg.id !== typingMsg.id));
      toastError("The assistant is temporarily unavailable. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-abyss-950/95 backdrop-blur sm:inset-auto sm:bottom-24 sm:right-5 sm:h-[460px] sm:w-[360px] sm:max-w-[calc(100vw-2.5rem)] sm:rounded-2xl sm:border sm:border-ocean-500/20 sm:shadow-2xl">
          <div className="flex items-center justify-between border-b border-ocean-500/10 bg-ocean-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-500/20 text-ocean-300">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Assistant</p>
                <p className="text-[10px] text-ocean-200/60">Ocean intelligence</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-ocean-200/60 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3" role="log" aria-live="polite" aria-label="AI Assistant conversation">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex gap-2", m.role === "user" && "justify-end")}
              >
                {m.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ocean-500/20 text-ocean-300">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-xs",
                    m.role === "user"
                      ? "bg-ocean-500/20 text-ocean-50"
                      : "bg-abyss-800 text-ocean-100"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-ocean-500/10 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={pending}
                  className="rounded-full border border-ocean-500/15 px-2 py-0.5 text-[10px] text-ocean-200/70 hover:bg-ocean-500/10 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={pending}
                placeholder="Ask about the ocean…"
                aria-label="Ask the AI Assistant about the ocean"
                className="flex-1 rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2 text-xs text-ocean-50 outline-none placeholder:text-ocean-200/40 focus:border-ocean-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={pending}
                aria-label="Send message"
                className="flex items-center justify-center rounded-lg bg-ocean-500 px-3 text-white hover:bg-ocean-400 disabled:opacity-50"
              >
                {pending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ocean-500 text-white shadow-lg shadow-ocean-500/30 transition-transform hover:scale-105 hover:bg-ocean-400 sm:bottom-5 sm:right-5"
        aria-label="Open AI Assistant"
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </>
  );
}
