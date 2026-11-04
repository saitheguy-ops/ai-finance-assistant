"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";

import type { ChatResponseBody, ChatTurn, ChatWidget } from "@/lib/chat/types";
import { errorMessage, fetchJson } from "@/lib/client/fetcher";
import { getPortfolioSnapshot, usePortfolio } from "@/lib/client/portfolio-store";
import { RichText } from "./RichText";
import { WidgetView } from "./Widgets";

interface DisplayMessage extends ChatTurn {
  id: number;
  widgets?: ChatWidget[];
  notice?: string;
  error?: boolean;
}

const SUGGESTIONS = ["price of NVDA", "how did MSFT do this month?", "compare AAPL MSFT", "buy 10 TSLA", "show my portfolio", "help"];

const GREETING: DisplayMessage = {
  id: 0,
  role: "assistant",
  content: "Hi, I'm **Jarvis**. Ask me about a stock, compare tickers, or place a paper trade. Every number comes from live market data.",
};

/** Shows whether Claude mode is on. The endpoint returns only a boolean. */
function AiBadge() {
  const { data } = useSWR("/api/ai-status", (url: string) => fetchJson<{ enabled: boolean }>(url), { revalidateOnFocus: false });
  if (!data) return null;
  return data.enabled ? (
    <span className="rounded-full bg-up-soft px-2 py-0.5 text-[10px] font-semibold text-up">AI: on</span>
  ) : (
    <span
      className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted"
      title="Set ANTHROPIC_API_KEY on the server to switch Jarvis to Claude. See the README."
    >
      AI: off — add a key to enable
    </span>
  );
}

/**
 * Floating "Ask Jarvis" chat. Lives in the root layout so the conversation
 * survives page navigation. Trades returned by the server are applied to the
 * localStorage portfolio here.
 */
export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const { applyTrades } = usePortfolio();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // New user message → scroll to bottom. New reply → show the start of it,
  // so a long answer with charts isn't scrolled past.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const last = list.querySelector<HTMLElement>("[data-msg]:last-of-type");
    if (!sending && last?.dataset.role === "assistant") last.scrollIntoView({ block: "start", behavior: "smooth" });
    else list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const userMsg: DisplayMessage = { id: nextId.current++, role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setSending(true);
    try {
      const res = await fetchJson<ChatResponseBody>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only plain text goes back to the server; widgets stay in the browser.
          messages: history.filter((m) => !m.error && m.id !== 0).map(({ role, content }) => ({ role, content })),
          portfolio: getPortfolioSnapshot(),
        }),
      });
      const tradeErrors = applyTrades(res.trades);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: "assistant",
          content: res.reply,
          widgets: res.widgets,
          notice: [res.notice, ...tradeErrors.map((e) => `Couldn't apply a trade locally: ${e}`)].filter(Boolean).join(" ") || undefined,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { id: nextId.current++, role: "assistant", content: errorMessage(err), error: true }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-contrast shadow-lg shadow-black/20 hover:opacity-95"
        >
          <span aria-hidden>✦</span> Ask Jarvis
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Jarvis chat"
          className="fixed inset-0 z-50 flex flex-col bg-surface sm:inset-auto sm:right-4 sm:bottom-4 sm:h-[min(640px,calc(100vh-2rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl sm:shadow-black/30"
        >
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-contrast" aria-hidden>
              ✦
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Jarvis</p>
              <AiBadge />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
            >
              ✕
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} data-msg data-role="user" className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-sm text-accent-contrast">{m.content}</p>
                </div>
              ) : (
                <div key={m.id} data-msg data-role="assistant" className="max-w-[95%] scroll-mt-2 text-sm">
                  <div className={`rounded-2xl rounded-bl-sm px-3 py-2 ${m.error ? "bg-down-soft text-down" : "bg-surface-2"}`}>
                    <RichText text={m.content} />
                  </div>
                  {m.widgets?.map((w, i) => <WidgetView key={i} widget={w} />)}
                  {m.notice && <p className="mt-1 text-xs text-warn-text">{m.notice}</p>}
                </div>
              ),
            )}
            {sending && (
              <p className="text-sm text-muted" role="status">
                <span className="inline-block animate-pulse">Jarvis is checking the data…</span>
              </p>
            )}
            {messages.length === 1 && !sending && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <div className="flex items-end gap-2">
              <label htmlFor="jarvis-input" className="sr-only">
                Message Jarvis
              </label>
              <textarea
                id="jarvis-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Try “how did NVDA do this month?”"
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-contrast disabled:opacity-50"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted">Educational only · not financial advice · paper trades use fake money</p>
          </form>
        </div>
      )}
    </>
  );
}
