"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, SendHorizontal, Bot, BarChart3, Users, Zap, MessageSquare, Instagram, Twitter, Linkedin, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: "Generate Report", icon: BarChart3, prompt: "Give me a full cross-platform performance report for today." },
  { label: "Lead Analysis", icon: Users, prompt: "Analyze my top leads across all platforms and prioritize them." },
  { label: "Automation Status", icon: Zap, prompt: "What automations are currently running and what's their status?" },
  { label: "WhatsApp Summary", icon: MessageSquare, prompt: "Summarize my recent WhatsApp conversations and pending replies." },
  { label: "Instagram Insights", icon: Instagram, prompt: "What are my Instagram engagement stats and top performing posts?" },
  { label: "LinkedIn Pipeline", icon: Linkedin, prompt: "Show me my LinkedIn B2B lead pipeline and connection requests." },
];

const AI_RESPONSES: Record<string, string> = {
  default: "I'm analyzing your cross-platform data now. Based on current orchestration signals, your engagement is trending **+12.4%** this week. Would you like a detailed breakdown by platform?",
  report: "📊 **Cross-Platform Report — Last 24h**\n\n• **WhatsApp**: 23 new messages, 4 pending replies, AI dispatched 11 responses\n• **Instagram**: 4.5K reach, 312 new followers, top post: 842 likes\n• **Twitter/X**: 12K impressions, 38 new mentions, trending hashtag: #Zynco\n• **LinkedIn**: 3 new connection requests, 2 inbound leads, post reach 2.1K\n\n**AI Recommendation**: Respond to the 4 WhatsApp leads within the next 2 hours to maximize conversion probability.",
  lead: "🎯 **Top Priority Leads**\n\n1. **Rahul M.** (WhatsApp) — High intent signal, asked about pricing 3x. Score: 94/100\n2. **Sarah K.** (LinkedIn) — VP at Series B startup, viewed your profile twice. Score: 88/100\n3. **Design Daily** (Instagram) — 45K followers, DM'd about collaboration. Score: 76/100\n\n**Action**: Draft personalized responses? I can generate them instantly.",
  automation: "⚡ **Active Automations**\n\n✅ WhatsApp Greeter — Running (142 triggers today)\n✅ LinkedIn Auto-Connect — Running (28 new connections)\n✅ Instagram DM Reply — Running (67 replies sent)\n⚠️ Twitter Mention Monitor — Rate limited, resuming in 14 min\n\n**Overall**: 3/4 automations healthy. Zero manual intervention needed.",
  whatsapp: "💬 **WhatsApp Digest**\n\n• 23 total messages today, 4 need your attention\n• Vikas (Product): Asked about V4 review deadline — *suggested reply ready*\n• Marco Polo: Inquired about integration status — *AI draft available*\n• 2 new unknown numbers — classified as potential leads\n\nWant me to draft responses for the pending messages?",
  instagram: "📸 **Instagram Intelligence**\n\n• **Reach today**: 4.5K (+18% vs yesterday)\n• **Top post**: Glassmorphism palette — 842 likes, 120 comments\n• **New followers**: 312 in the last 24h\n• **Story views**: 1.2K avg\n\n**AI Insight**: Posting between 6–8 PM IST yields 2.3x more engagement for your audience. Want me to schedule your next post?",
  linkedin: "💼 **LinkedIn B2B Pipeline**\n\n• **Inbound leads**: 2 (Satya Nadella's org, TechScale VC)\n• **Connection requests**: 3 pending your review\n• **Post impressions**: 2.1K — above your 30-day avg\n• **Profile views**: 47 this week (+34%)\n\n**Recommendation**: Follow up with your Tuesday connections — optimal window is now.",
};

function getAIResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("report") || lower.includes("performance")) return AI_RESPONSES.report;
  if (lower.includes("lead") || lower.includes("prioritize") || lower.includes("pipeline") && lower.includes("lead")) return AI_RESPONSES.lead;
  if (lower.includes("automation") || lower.includes("running") || lower.includes("status")) return AI_RESPONSES.automation;
  if (lower.includes("whatsapp") || lower.includes("message") || lower.includes("chat")) return AI_RESPONSES.whatsapp;
  if (lower.includes("instagram") || lower.includes("ig") || lower.includes("reel")) return AI_RESPONSES.instagram;
  if (lower.includes("linkedin") || lower.includes("b2b") || lower.includes("connection")) return AI_RESPONSES.linkedin;
  return AI_RESPONSES.default;
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('•') || line.startsWith('-')) {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
              <span className="text-blue-500 mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^[•\-]\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }
        if (/^\d+\./.test(line)) {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-700 leading-relaxed">
              <span className="text-blue-500 font-bold shrink-0">{line.match(/^\d+/)?.[0]}.</span>
              <span dangerouslySetInnerHTML={{ __html: line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          );
        }
        if (line === '') return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-sm text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        );
      })}
    </div>
  );
}

export default function ZyncoChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm **Zynco AI**, your cross-platform orchestration assistant. I can generate reports, analyze leads, summarize your WhatsApp/Instagram/LinkedIn activity, and much more.\n\nWhat would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 800));

    const aiResponse = getAIResponse(text);
    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: aiResponse, timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ width: 420, height: 600 }}
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
                    <span className="text-xs font-bold uppercase" style={{ color: '#94a3b8', letterSpacing: '0.1em', fontSize: 9 }}>Orchestration Online</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: '#64748b' }}
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
                      : <MarkdownText content={msg.content} />
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

              {/* Quick actions — only show if just welcome message */}
              {messages.length === 1 && !isTyping && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-black uppercase" style={{ color: '#94a3b8', letterSpacing: '0.1em' }}>Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACTIONS.map(action => (
                      <button
                        key={action.label}
                        onClick={() => sendMessage(action.prompt)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{ background: 'white', border: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#475569' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
                      >
                        <action.icon className="w-3.5 h-3.5 shrink-0" />
                        {action.label}
                      </button>
                    ))}
                  </div>
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
        style={{
          background: isOpen ? '#0f172a' : '#2563eb',
          boxShadow: isOpen ? '0 8px 32px rgba(15,23,42,0.4)' : '0 8px 32px rgba(37,99,235,0.5)',
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
