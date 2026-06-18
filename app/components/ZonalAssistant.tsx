"use client";

import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles } from "lucide-react";

export type AssistantContext = {
  street?: string;
  barangay?: string;
  city?: string;
  province?: string;
  classification?: string;
  zonalValue?: string;
} | null;

type Msg = { role: "user" | "assistant"; content: string; suggestions?: string[] };

const LOGO = "/pictures/zonal%20ai-Photoroom.png";

const SUGGESTIONS = [
  "What's the zonal value of this property?",
  "Which classification is the most expensive here?",
  "What does the zonal value mean?",
];

const NAVY = "#1e3a8a";
const GOLD = "#c9a84c";

export default function ZonalAssistant({
  domain,
  context,
}: {
  domain: string;
  context?: AssistantContext;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const question = String(text ?? input).trim();
    if (!question || loading) return;
    const myId = ++reqRef.current;

    const nextMessages = [...messages, { role: "user", content: question } as Msg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          domain,
          context: context ?? null,
          history: messages.slice(-12), // remember the last ~6 turns
        }),
      });
      const data = await res.json().catch(() => null);
      if (myId !== reqRef.current) return;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Something went wrong");
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: String(data.text ?? "").trim(),
          suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8) : [],
        },
      ]);
    } catch (e: any) {
      if (myId !== reqRef.current) return;
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Sorry — ${e?.message ?? "I couldn't answer that."}` },
      ]);
    } finally {
      if (myId === reqRef.current) setLoading(false);
    }
  };

  return (
    <>
      {/* ───────────── Launcher: floating logo, glow only (no solid box) ───────────── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group fixed bottom-28 right-6 z-[70] transition active:scale-95"
          title="Ask the Zonal AI Assistant"
          aria-label="Open Zonal AI Assistant"
        >
          {/* soft diffused white glow so the logo reads on any map */}
          <span className="za-glow" aria-hidden />
          <span className="za-float relative block">
            <img
              src={LOGO}
              alt="Zonal AI"
              className="relative h-28 w-28 object-contain transition group-hover:scale-110"
              style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.45))" }}
            />
            <span className="za-dot" aria-hidden />
          </span>

          <style jsx>{`
            .za-glow {
              position: absolute;
              left: 50%;
              top: 50%;
              width: 140px;
              height: 140px;
              transform: translate(-50%, -50%);
              border-radius: 9999px;
              background: radial-gradient(
                circle,
                rgba(255, 255, 255, 0.85) 0%,
                rgba(255, 255, 255, 0.35) 45%,
                rgba(255, 255, 255, 0) 72%
              );
              filter: blur(6px);
              animation: za-pulse 2s ease-in-out infinite;
              pointer-events: none;
            }
            .za-float {
              animation: za-bob 3s ease-in-out infinite;
            }
            .za-dot {
              position: absolute;
              top: 10px;
              right: 12px;
              width: 13px;
              height: 13px;
              border-radius: 9999px;
              background: #e11d48;
              border: 2px solid #fff;
              animation: za-ping 1.8s ease-out infinite;
            }
            @keyframes za-pulse {
              0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.9); }
              50%      { opacity: 0.95; transform: translate(-50%, -50%) scale(1.2); }
            }
            @keyframes za-bob {
              0%, 100% { transform: translateY(0); }
              50%      { transform: translateY(-9px); }
            }
            @keyframes za-ping {
              0%   { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0.55); }
              70%  { box-shadow: 0 0 0 9px rgba(225, 29, 72, 0); }
              100% { box-shadow: 0 0 0 0 rgba(225, 29, 72, 0); }
            }
          `}</style>
        </button>
      )}

      {/* ───────────────────────── Chat room ───────────────────────── */}
      {open && (
        <div className="za-panel fixed bottom-5 right-5 z-[70] flex w-[93vw] max-w-[400px] flex-col overflow-hidden">
          {/* Header */}
          <div className="za-header relative px-4 pb-4 pt-3.5">
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={LOGO}
                  alt="Zonal AI"
                  className="h-12 w-12 object-contain"
                  style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-[15px] font-extrabold leading-tight text-white">
                    Zonal AI
                    <Sparkles size={14} style={{ color: GOLD }} />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium leading-tight text-white/70">
                    <span className="za-online" /> Online · answers from your data
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-white/70 transition hover:bg-white/15 hover:text-white"
                title="Close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="za-body flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
            {messages.length === 0 && (
              <div className="za-in space-y-3">
                <Bubble role="assistant">
                  👋 Hi! I&apos;m your Zonal AI assistant. Ask me about zonal values — a specific
                  street, barangay, or the property you have selected. I answer straight from our
                  zonal database.
                </Bubble>
                <div className="flex flex-col gap-2 pl-10">
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400">
                    Try asking
                  </div>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="za-chip text-left text-[12.5px] font-semibold"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <Bubble role={m.role}>{m.content}</Bubble>
                {m.role === "assistant" && m.suggestions && m.suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-11">
                    {m.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(`What's the zonal value in ${s}?`)}
                        className="za-suggest text-[12px] font-semibold"
                        title={`Ask about ${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-end gap-2">
                <Avatar />
                <div className="za-typing">
                  <span /> <span /> <span />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="za-inputbar flex items-end gap-2 px-3 py-2.5">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask about a zonal value…"
              className="za-textarea max-h-24 flex-1 resize-none px-4 py-2.5 text-[13px] outline-none"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="za-send flex h-10 w-10 shrink-0 items-center justify-center disabled:opacity-40"
              title="Send"
              aria-label="Send"
            >
              <Send size={17} />
            </button>
          </div>

          <style jsx>{`
            .za-panel {
              height: min(620px, 85vh);
              border-radius: 26px;
              background: #ffffff;
              border: 1px solid rgba(201, 168, 76, 0.5);
              box-shadow: 0 24px 60px -12px rgba(15, 23, 60, 0.5),
                0 0 0 1px rgba(255, 255, 255, 0.4) inset;
              animation: za-rise 0.28s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .za-header {
              background: radial-gradient(
                  120% 120% at 0% 0%,
                  #2b4cb0 0%,
                  ${NAVY} 55%,
                  #16285c 100%
                );
              box-shadow: 0 6px 18px -8px rgba(15, 23, 60, 0.6);
            }
            .za-online {
              display: inline-block;
              height: 7px;
              width: 7px;
              border-radius: 9999px;
              background: #34d399;
              box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
              animation: za-ping2 1.8s ease-out infinite;
            }
            .za-body {
              background: linear-gradient(180deg, #f7f8fc 0%, #eef1f8 100%);
            }
            .za-chip {
              border-radius: 14px;
              border: 1.5px solid rgba(201, 168, 76, 0.55);
              background: #fff;
              color: ${NAVY};
              padding: 9px 13px;
              transition: all 0.18s ease;
              box-shadow: 0 1px 2px rgba(15, 23, 60, 0.05);
            }
            .za-chip:hover {
              transform: translateY(-1px);
              border-color: ${GOLD};
              box-shadow: 0 6px 14px -6px rgba(201, 168, 76, 0.6);
            }
            .za-suggest {
              border-radius: 9999px;
              border: 1.5px solid ${NAVY};
              background: rgba(30, 58, 138, 0.06);
              color: ${NAVY};
              padding: 5px 12px;
              transition: all 0.16s ease;
            }
            .za-suggest:hover {
              background: ${NAVY};
              color: #fff;
              transform: translateY(-1px);
              box-shadow: 0 5px 12px -5px rgba(30, 58, 138, 0.7);
            }
            .za-typing {
              display: inline-flex;
              gap: 4px;
              align-items: center;
              background: #fff;
              border: 1px solid #eef0f5;
              border-radius: 16px;
              border-bottom-left-radius: 4px;
              padding: 11px 14px;
              box-shadow: 0 2px 8px rgba(15, 23, 60, 0.06);
            }
            .za-typing span {
              height: 7px;
              width: 7px;
              border-radius: 9999px;
              background: ${NAVY};
              opacity: 0.5;
              animation: za-typing 1.2s infinite ease-in-out;
            }
            .za-typing span:nth-child(2) { animation-delay: 0.15s; }
            .za-typing span:nth-child(3) { animation-delay: 0.3s; }
            .za-inputbar {
              background: #fff;
              border-top: 1px solid #eef0f5;
            }
            .za-textarea {
              border-radius: 18px;
              background: #f3f5fa;
              border: 1.5px solid transparent;
              transition: all 0.18s ease;
              line-height: 1.4;
            }
            .za-textarea:focus {
              background: #fff;
              border-color: ${NAVY};
              box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.12);
            }
            .za-send {
              border-radius: 9999px;
              color: #fff;
              background: linear-gradient(135deg, #2b4cb0, ${NAVY});
              box-shadow: 0 6px 14px -4px rgba(30, 58, 138, 0.65);
              transition: all 0.18s ease;
            }
            .za-send:not(:disabled):hover {
              transform: translateY(-1px) scale(1.05);
              box-shadow: 0 8px 18px -4px rgba(30, 58, 138, 0.8);
            }
            @keyframes za-rise {
              from { opacity: 0; transform: translateY(16px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes za-typing {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30%           { transform: translateY(-4px); opacity: 1; }
            }
            @keyframes za-ping2 {
              0%   { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.6); }
              70%  { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
              100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

/* ── Small presentational pieces ── */

function Avatar() {
  return (
    <img
      src={LOGO}
      alt=""
      className="h-9 w-9 shrink-0 self-end object-contain"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
    />
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`za-in flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <Avatar />}
      <div
        className="max-w-[78%] whitespace-pre-wrap px-3.5 py-2.5 text-[13px] leading-relaxed"
        style={
          isUser
            ? {
                color: "#fff",
                background: `linear-gradient(135deg, #2b4cb0, ${NAVY})`,
                borderRadius: 18,
                borderBottomRightRadius: 5,
                boxShadow: "0 6px 14px -6px rgba(30,58,138,0.55)",
              }
            : {
                color: "#1f2937",
                background: "#fff",
                borderRadius: 18,
                borderBottomLeftRadius: 5,
                border: "1px solid #eef0f5",
                boxShadow: "0 2px 8px rgba(15,23,60,0.06)",
              }
        }
      >
        {children}
      </div>
      <style jsx>{`
        .za-in {
          animation: za-msg 0.26s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes za-msg {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
