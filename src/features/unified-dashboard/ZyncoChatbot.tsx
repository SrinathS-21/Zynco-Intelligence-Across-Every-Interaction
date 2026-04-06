"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Sparkles, X, SendHorizontal, Bot, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type ChatRequestSource = "instagram" | "linkedin" | "email" | "whatsapp" | "automation" | "twitter";

type ZyncoChatbotProps = {
  openSignal?: number;
  source?: ChatRequestSource;
  context?: string;
  pageLabel?: string;
};

const CHAT_API_ENDPOINT = "/api/ai/chat";

const AI_RESPONSES: Record<string, string> = {
  default: "I'm analyzing your cross-platform data now. Based on current orchestration signals, your engagement is trending **+12.4%** this week. Would you like a detailed breakdown by platform?",
  report: "📊 **Cross-Platform Report — Last 24h**\n\n• **WhatsApp**: 23 new messages, 4 pending replies, AI dispatched 11 responses\n• **Instagram**: 4.5K reach, 312 new followers, top post: 842 likes\n• **Twitter/X**: 12K impressions, 38 new mentions, trending hashtag: #Zynco\n• **LinkedIn**: 3 new connection requests, 2 inbound leads, post reach 2.1K\n\n**AI Recommendation**: Respond to the 4 WhatsApp leads within the next 2 hours to maximize conversion probability.",
  lead: "🎯 **Top Priority Leads**\n\n1. **Rahul M.** (WhatsApp) — High intent signal, asked about pricing 3x. Score: 94/100\n2. **Sarah K.** (LinkedIn) — VP at Series B startup, viewed your profile twice. Score: 88/100\n3. **Design Daily** (Instagram) — 45K followers, DM'd about collaboration. Score: 76/100\n\n**Action**: Draft personalized responses? I can generate them instantly.",
  automation: "⚡ **Active Automations**\n\n✅ WhatsApp Greeter — Running (142 triggers today)\n✅ LinkedIn Auto-Connect — Running (28 new connections)\n✅ Instagram DM Reply — Running (67 replies sent)\n⚠️ Twitter Mention Monitor — Rate limited, resuming in 14 min\n\n**Overall**: 3/4 automations healthy. Zero manual intervention needed.",
  whatsapp: "💬 **WhatsApp Digest**\n\n• 23 total messages today, 4 need your attention\n• Vikas (Product): Asked about V4 review deadline — *suggested reply ready*\n• Marco Polo: Inquired about integration status — *AI draft available*\n• 2 new unknown numbers — classified as potential leads\n\nWant me to draft responses for the pending messages?",
  instagram: "📸 **Instagram Intelligence**\n\n• **Reach today**: 4.5K (+18% vs yesterday)\n• **Top post**: Glassmorphism palette — 842 likes, 120 comments\n• **New followers**: 312 in the last 24h\n• **Story views**: 1.2K avg\n\n**AI Insight**: Posting between 6–8 PM IST yields 2.3x more engagement for your audience. Want me to schedule your next post?",
  linkedin: "💼 **LinkedIn B2B Pipeline**\n\n• **Inbound leads**: 2 (Satya Nadella's org, TechScale VC)\n• **Connection requests**: 3 pending your review\n• **Post impressions**: 2.1K — above your 30-day avg\n• **Profile views**: 47 this week (+34%)\n\n**Recommendation**: Follow up with your Tuesday connections — optimal window is now.",
};

function sourceLabel(source: ChatRequestSource): string {
  if (source === "twitter") return "Twitter/X";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function shouldUsePageContext(message: string) {
  const text = message.toLowerCase().trim();
  if (!text) return false;

  const explicitPatterns = [
    /read\s+my\s+page/,
    /check\s+my\s+page/,
    /look\s+at\s+my\s+page/,
    /what\s+do\s+you\s+see/,
    /use\s+(the|this|my)?\s*context/,
    /take\s+(the|this|my)?\s*page\s+as\s+context/,
    /(based\s+on|from|using)\s+(this|my|the)?\s*(page|screen|dashboard|workspace|context)/,
    /(recheck|re-check|check\s+again|look\s+again).*(page|screen|dashboard|workspace)/,
  ];

  if (explicitPatterns.some((pattern) => pattern.test(text))) {
    return true;
  }

  const pageTerms = ["page", "screen", "dashboard", "workspace", "context", "what i see", "current view"];
  const contextIntentTerms = ["look", "check", "read", "scan", "review", "see", "recheck", "use", "based on", "from", "using"];

  const hasPageTerm = pageTerms.some((term) => text.includes(term));
  const hasContextIntent = contextIntentTerms.some((term) => text.includes(term));

  return hasPageTerm && hasContextIntent;
}

function getAIResponse(message: string, source: ChatRequestSource): string {
  const lower = message.toLowerCase();
  if (lower.includes("report") || lower.includes("performance")) return AI_RESPONSES.report;
  if (lower.includes("lead") || lower.includes("prioritize") || lower.includes("pipeline") && lower.includes("lead")) return AI_RESPONSES.lead;
  if (lower.includes("automation") || lower.includes("running") || lower.includes("status")) return AI_RESPONSES.automation;
  if (lower.includes("whatsapp") || lower.includes("message") || lower.includes("chat")) return AI_RESPONSES.whatsapp;
  if (lower.includes("instagram") || lower.includes("ig") || lower.includes("reel")) return AI_RESPONSES.instagram;
  if (lower.includes("linkedin") || lower.includes("b2b") || lower.includes("connection")) return AI_RESPONSES.linkedin;
  return `${AI_RESPONSES.default}\n\nI can tailor this to your current ${sourceLabel(source)} page context if you tell me exactly what you want to draft, analyze, or troubleshoot.`;
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="text-sm text-slate-700 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
        em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
        ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h3 className="mt-1 text-sm font-bold text-slate-900">{children}</h3>,
        h2: ({ children }) => <h3 className="mt-1 text-sm font-bold text-slate-900">{children}</h3>,
        h3: ({ children }) => <h4 className="mt-1 text-sm font-semibold text-slate-900">{children}</h4>,
        code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-slate-800">{children}</code>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function ZyncoChatbot({ openSignal = 0, source = "automation", context, pageLabel }: ZyncoChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm **Zynco AI**. It's great to see you here.\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (openSignal > 0) {
      setIsOpen(true);
    }
  }, [openSignal]);

  useEffect(() => {
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setRequestError(null);

    try {
      const response = await fetch(CHAT_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          source,
          context: shouldUsePageContext(trimmed) ? context : undefined,
          history: messages.slice(-8).map((msg) => ({ role: msg.role, content: msg.content })),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`);
      }

      const data = await response.json() as { reply?: string };
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply?.trim() || getAIResponse(trimmed, source),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      const fallbackMessage = getAIResponse(trimmed, source);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: fallbackMessage,
          timestamp: new Date(),
        },
      ]);
      setRequestError("Realtime AI is temporarily unavailable. Showing a smart fallback response.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 z-9999 flex flex-col items-end gap-3">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ width: "100%", maxWidth: 420, height: "min(75dvh, 600px)", maxHeight: "calc(100dvh - 7rem)" }}
            className="flex flex-col rounded-3xl overflow-hidden shadow-2xl"
          // Fully opaque, no transparency
          >
            {/* HEADER */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: '#0f172a' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#2563eb' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'white' }} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: 'white', letterSpacing: '-0.02em' }}>Zynco AI Assistant</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#34d399' }} />
                    <span className="text-xs font-bold uppercase" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontSize: 9 }}>
                      {pageLabel ? `Context: ${pageLabel}` : "Orchestration Online"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#64748b' }}
                aria-label="Close chatbot"
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* MESSAGES */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ background: '#f8fafc' }}>
              {messages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                      <Bot className="w-4 h-4" style={{ color: '#2563eb' }} />
                    </div>
                  )}
                  <div
                    className="max-w-[78%] px-4 py-3 rounded-2xl"
                    style={msg.role === 'user'
                      ? { background: '#2563eb', borderBottomRightRadius: 4 }
                      : { background: 'white', borderBottomLeftRadius: 4, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
                    }
                  >
                    {msg.role === 'user'
                      ? <p className="text-sm font-medium" style={{ color: 'white' }}>{msg.content}</p>
                      : <AssistantMarkdown content={msg.content} />
                    }
                    <p className="text-xs mt-1.5" style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                    <Bot className="w-4 h-4" style={{ color: '#2563eb' }} />
                  </div>
                  <div className="px-4 py-3 rounded-2xl" style={{ background: 'white', border: '1px solid #e2e8f0', borderBottomLeftRadius: 4 }}>
                    <div className="flex gap-1 items-center h-5">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ background: '#94a3b8' }}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {requestError && (
                <div className="rounded-xl px-3 py-2 text-xs font-medium border" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fde68a' }}>
                  {requestError}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* INPUT */}
            <div className="px-4 py-3 shrink-0" style={{ background: 'white', borderTop: '1px solid #e2e8f0' }}>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Zynco anything..."
                  className="flex-1 outline-none text-sm font-medium px-4 h-11 rounded-xl"
                  style={{ background: '#f1f5f9', color: '#0f172a', border: 'none' }}
                  disabled={isTyping}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isTyping}
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  aria-label="Send message"
                  style={{
                    background: input.trim() && !isTyping ? '#2563eb' : '#e2e8f0',
                    cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed'
                  }}
                >
                  <SendHorizontal className="w-4 h-4" style={{ color: input.trim() && !isTyping ? 'white' : '#94a3b8' }} />
                </button>
              </div>
              <p className="text-center mt-2" style={{ fontSize: 9, color: '#cbd5e1', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Zynco Intelligence Agent • Cross-Platform AI
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB BUTTON */}
      <motion.button
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(prev => !prev)}
        className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
        style={{
          background: '#0f172a',
          boxShadow: isOpen ? '0 8px 32px rgba(15,23,42,0.45)' : '0 8px 32px rgba(15,23,42,0.38)',
        }}
      >
        {!isOpen && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-black"
            style={{ background: '#ef4444', fontSize: 8 }}
          >
            3
          </span>
        )}
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="w-7 h-7" style={{ color: 'white' }} />
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Sparkles className="w-7 h-7" style={{ color: 'white' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
