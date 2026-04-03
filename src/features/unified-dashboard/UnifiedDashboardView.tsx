"use client";

import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Bell, 
  Plus, 
  MessageSquare, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Mail, 
  Slack, 
  Github, 
  MoreVertical,
  MoreHorizontal,
  Heart,
  Repeat,
  Share,
  MessageCircle,
  Hash,
  Filter,
  Users,
  LayoutDashboard,
  Settings,
  HelpCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  SendHorizontal,
  Send,
  Image,
  Bot,
  Zap,
  Play,
  Pause,
  ShieldCheck,
  Copy,
  ChevronDown,
  BarChart3,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Link from "next/link";
import EmailClassifierEditor from "@/features/standalone-agents/agents/gmail-classifier/editor";
import ZyncoChatbot from "./ZyncoChatbot";

// Local platform definition to avoid top-level collision
const DASHBOARD_PLATFORMS = [
  { id: "whatsapp", name: "WhatsApp", desc: "Direct Messaging Hub", icon: <MessageSquare className="w-6 h-6" />, color: "bg-emerald-50 text-emerald-600", border: "hover:border-emerald-200" },
  { id: "instagram", name: "Instagram", desc: "Brand Feed & Media", icon: <Instagram className="w-6 h-6" />, color: "bg-pink-50 text-pink-600", border: "hover:border-pink-200" },
  { id: "twitter", name: "Twitter (X)", desc: "Global Stream Monitor", icon: <Twitter className="w-6 h-6" />, color: "bg-slate-50 text-slate-900", border: "hover:border-slate-300" },
  { id: "linkedin", name: "LinkedIn", desc: "B2B Lead Intelligence", icon: <Linkedin className="w-6 h-6" />, color: "bg-blue-50 text-blue-600", border: "hover:border-blue-200" },
  { id: "gmail", name: "Gmail AI", desc: "Automated Classifier", icon: <Mail className="w-6 h-6" />, color: "bg-red-50 text-red-600", border: "hover:border-red-200" },
  { id: "all", name: "Unified Feed", desc: "Collective Interaction", icon: <Sparkles className="w-6 h-6" />, color: "bg-violet-50 text-violet-600", border: "hover:border-violet-200" }
];

const MOCK_MESSAGES = [
  {
    id: "1",
    platform: "twitter",
    user: { name: "Naval", handle: "@naval", avatar: "" },
    content: "The best way to escape the competition is to be authentic.",
    timestamp: "2m ago",
    likes: "12K",
    replies: "842",
    retweets: "3.1K",
  },
  {
    id: "2",
    platform: "whatsapp",
    user: { name: "Vikas (Product)", handle: "WhatsApp", avatar: "" },
    content: "Hey team, the new V4 design system is ready for review. Check out the Figma link in Slack.",
    timestamp: "15m ago",
    unread: true,
  },
  {
    id: "3",
    platform: "instagram",
    user: { name: "Design Inspiration", handle: "@design_daily", avatar: "" },
    content: "Exploring the intersections of HSL colors and glassmorphism. What do you think of this palette?",
    timestamp: "1h ago",
    likes: "4.5K",
    replies: "120",
  },
  {
    id: "4",
    platform: "linkedin",
    user: { name: "Satya Nadella", handle: "CEO @ Microsoft", avatar: "" },
    content: "Empowering every person and every organization on the planet to achieve more. Today's update on AI scaling is a milestone.",
    timestamp: "3h ago",
    likes: "45K",
    comments: "1.2K",
  },
  {
    id: "5",
    platform: "gmail",
    user: { name: "Google Cloud", handle: "billing@google.com", avatar: "" },
    content: "Your monthly invoice for project 'Zynco-Agent' is now available. Total: $14.20",
    timestamp: "5h ago",
    priority: "high",
  },
  {
    id: "6",
    platform: "slack",
    user: { name: "Sarah Connor", handle: "#engineering", avatar: "" },
    content: "The deployment to production failed. Investigating the logs now. Initial findings suggest a timeout in the database connection.",
    timestamp: "6h ago",
    mentions: true,
  },
];

export default function UnifiedDashboardView({ userId }: { userId: string }) {
  const [activePlatform, setActivePlatform] = useState<string>("dashboard");
  const [tempInstagramKey, setTempInstagramKey] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postRecipient, setPostRecipient] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [showScheduler, setShowScheduler] = useState(false);
  
  // WhatsApp Chat State
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  // High-Fidelity Mock Interaction Data for WhatsApp
  const [messages, setMessages] = useState<any[]>([
    {
      id: 'wa-1', sender: 'Sarah Jenkins', from: '123456789@c.us',
      body: "Hey! Can you tell me more about the premium subscription for Zynco?",
      fromMe: false, timestamp: Math.floor(Date.now()/1000) - 3600
    },
    {
      id: 'wa-2', sender: 'Me', from: 'me',
      body: "*[Zynco AI]* Thanks Sarah! I'm your premium advisor. How can I help?",
      fromMe: true, timestamp: Math.floor(Date.now()/1000) - 3550
    },
    {
       id: 'wa-3', sender: 'Marco Polo', from: '987654321@c.us',
       body: "Is the WhatsApp integration live?", fromMe: false, timestamp: Math.floor(Date.now()/1000) - 13000
    }
  ]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [postImage, setPostImage] = useState<string | null>(null);

  const [linkedinToken, setLinkedinToken] = useState<string | null>(null);
  const [linkedinFeed, setLinkedinFeed] = useState<any[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedPostIds, setExpandedPostIds] = useState<string[]>([]);
  
  const [twitterFeed, setTwitterFeed] = useState<any[]>([]);
  const [expandedTwitterPostIds, setExpandedTwitterPostIds] = useState<string[]>([]);
  const [twitterToken, setTwitterToken] = useState<string | null>(null);

  const [instagramFeed, setInstagramFeed] = useState<any[]>([]);
  const [expandedInstagramPostIds, setExpandedInstagramPostIds] = useState<string[]>([]);
  const [instagramToken, setInstagramToken] = useState<string | null>(null);
  const [waEngineStatus, setWaEngineStatus] = useState<string>("READY");
  const [waQR, setWaQR] = useState<string | null>(null);
  const [ruleTrigger, setRuleTrigger] = useState("When receiving ANY new message");
  const [rulePersona, setRulePersona] = useState("Friendly Greeting Assistant");

  // WhatsApp Polling (Disabled for Mock Demo)
  useEffect(() => {
     // Interval polling logic disabled for stability
  }, [activePlatform]);

  useEffect(() => {

    const savedIgKey = localStorage.getItem('ayrshare_key');
    if (savedIgKey) {
        setInstagramToken(savedIgKey);
    }

    // Check for LinkedIn & Twitter callback success/error
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    const error = params.get('linkedin_error');
    const success = params.get('linkedin_success');
    
    // Twitter specific
    const twitterTokenParam = params.get('twitter_token');
    const twitterSuccess = params.get('twitter_success');
    
    const targetPlatform = params.get('platform');
    
    if (targetPlatform) {
        setActivePlatform(targetPlatform);
    }

    if (token) {
        setLinkedinToken(String(token));
        toast.success("LinkedIn connected successfully!");
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (twitterTokenParam && twitterSuccess === '1') {
        setTwitterToken(String(twitterTokenParam));
        toast.success("Connected to X/Twitter via RapidAPI");
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error) {
        toast.error(`LinkedIn Error: ${decodeURIComponent(String(error))}`);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (success === '1') {
        toast.success("Connected to LinkedIn Hub");
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
        const res = await fetch('/api/whatsapp/contacts');
        const data = await res.json();
        if (Array.isArray(data)) {
            // Sort by timestamp and take top 200
            const sorted = data.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
            setContacts(sorted.slice(0, 200));
        } else {
            setContacts([]);
        }
    } catch (err) {
        console.error('Failed to fetch contacts', err);
        setContacts([]);
    }
  }, []);

  const fetchMessages = useCallback(async (contactId: string) => {
    try {
        setIsLoadingMessages(true);
        const res = await fetch(`/api/whatsapp/messages?contactId=${encodeURIComponent(contactId)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
            setMessages(data);
        } else {
            setMessages([]);
        }
    } catch (err) {
        console.error('Failed to fetch messages', err);
        setMessages([]);
    } finally {
        setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    async function initGmailAgent() {
        try {
            const res = await fetch("/api/standalone-agents/gmail-classifier/init", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (res.ok && data.agent) {
                setAgentId(data.agent.id);
            }
        } catch (e) {
            console.error("Failed to init Gmail agent", e);
        }
    }
    void initGmailAgent();

    if (activePlatform === 'whatsapp') {
        fetchContacts();
        const interval = setInterval(fetchContacts, 10000); // Poll contacts
        return () => clearInterval(interval);
    }
  }, [activePlatform, fetchContacts]);

  useEffect(() => {
    if (activeContact) {
        setPostRecipient(activeContact); // Automatically set recipient for Quick Post
        fetchMessages(activeContact);
        const interval = setInterval(() => fetchMessages(activeContact), 5000); // Poll active chat
        return () => clearInterval(interval);
    }
  }, [activeContact, fetchMessages]);

  useEffect(() => {
      if (activePlatform === 'linkedin') {
          const fetchHistory = async () => {
              setIsLoadingFeed(true);
              try {
                  const res = await fetch(`/api/linkedin/history?userId=${userId}`);
                  const data = await res.json();
                  if (Array.isArray(data)) setLinkedinFeed(data);
              } catch (err) {
                  console.error("Failed to fetch history", err);
              } finally {
                  setIsLoadingFeed(false);
              }
          };
          fetchHistory();
      } else if (activePlatform === 'twitter') {
          const fetchTwitterHistory = async () => {
              setIsLoadingFeed(true);
              try {
                  const res = await fetch(`/api/twitter/history?userId=${userId}`);
                  const data = await res.json();
                  if (Array.isArray(data)) setTwitterFeed(data);
              } catch (err) {
                  console.error("Failed to fetch twitter history", err);
              } finally {
                  setIsLoadingFeed(false);
              }
          };
          fetchTwitterHistory();
      } else if (activePlatform === 'instagram') {
          const fetchInstagramHistory = async () => {
              setIsLoadingFeed(true);
              try {
                  const res = await fetch(`/api/instagram/history?userId=${userId}`);
                  const data = await res.json();
                  if (Array.isArray(data)) setInstagramFeed(data);
              } catch (err) {
                  console.error("Failed to fetch instagram history", err);
              } finally {
                  setIsLoadingFeed(false);
              }
          };
          fetchInstagramHistory();
      }
  }, [activePlatform, userId, refreshKey]);

  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleAIDraft = async () => {
    if (!postContent) {
        toast.info("Write a few words to help the AI generate a draft!");
        return;
    }
    setIsAiLoading(true);
    try {
        const res = await fetch('/api/ai/draft', {
            method: 'POST',
            body: JSON.stringify({ prompt: postContent, context: { platform: activePlatform } })
        });
        const data = await res.json();
        if (data.draft) setPostContent(String(data.draft));
        toast.success("AI draft ready!");
    } catch (err) {
        console.error('AI Draft failed', err);
        toast.error("AI Assistant is busy, try again!");
    } finally {
        setIsAiLoading(false);
    }
  };
  const handlePost = async () => {
    if (!postContent) return;
    setIsPosting(true);
    try {
      if (activePlatform === 'whatsapp') {
          const res = await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipientId: postRecipient || activeContact, text: postContent }),
          });
          if (res.ok) {
              toast.success("WhatsApp message sent");
              setPostContent("");
              if (activeContact) fetchMessages(activeContact);
          } else {
              toast.error("Failed to send WhatsApp message");
          }
      } else if (activePlatform === 'linkedin') {
          // Extract a dynamic title from the generated content's first line (stripping markdown)
          const firstLine = postContent.split('\n').filter(l => l.trim().length > 0)[0] || '';
          const cleanTitle = firstLine.replace(/[\*\_\[\]]/g, '').slice(0, 60).trim() || 'LinkedIn Update';

          const res = await fetch('/api/linkedin/post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: postContent, 
                title: cleanTitle,
                userId, 
                token: linkedinToken,
                media: postImage 
              }),
          });
          if (res.ok) {
              toast.success("Post shared on LinkedIn");
              setPostContent("");
              setPostImage(null);
              setRefreshKey(prev => prev + 1); // Trigger history re-fetch
          } else {
              const err = await res.json();
              const errorMessage = typeof err.error === 'string' ? err.error : 
                                 (err.error?.message || "Failed to post to LinkedIn");
              toast.error(errorMessage);
          }
      } else if (activePlatform === 'instagram') {
          const firstLine = postContent.split('\n').filter(l => l.trim().length > 0)[0] || '';
          const cleanTitle = firstLine.replace(/[\*\_\[\]]/g, '').slice(0, 60).trim() || 'Instagram Connect';

          if (!postImage) {
              toast.error("Instagram Validation: You must attach at least one media image to publish!");
              setIsPosting(false);
              return;
          }

          const res = await fetch('/api/instagram/post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                text: postContent, 
                title: cleanTitle,
                userId, 
                media: postImage,
                token: instagramToken
              }),
          });
          if (res.ok) {
              toast.success("Post shipped via Ayrshare for Instagram");
              setPostContent("");
              setPostImage(null);
              setRefreshKey(prev => prev + 1);
          } else {
              const err = await res.json();
              toast.error(`Instagram API Error: ${err.error || "Failed to publish"}`);
          }
      } else {
          toast.info(`Sharing to ${activePlatform} (Simulation Mode)`);
          setPostContent("");
      }
    } catch (err: any) {
        toast.error("An unexpected error occurred during dispatch");
    } finally {
        setIsPosting(false);
    }
  };

  const filteredMessages = MOCK_MESSAGES.filter(m => 
    (activePlatform === "all" || m.platform === activePlatform) &&
    (m.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
     m.user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden font-sans selection:bg-blue-100">
      <AnimatePresence mode="wait">
        {activePlatform === "dashboard" ? (
          <motion.div 
            key="hub"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 overflow-auto bg-slate-50/30 selection:bg-blue-200"
          >
            <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-10">
               {/* 🚀 PREMIUM HEADER */}
               <header className="flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-3 text-center md:text-left">
                     <div className="flex justify-center md:justify-start items-center gap-4">
                        <motion.div 
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.8 }}
                          className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-blue-500/20 ring-4 ring-white"
                        >
                          Z
                        </motion.div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">Zynco<span className="text-blue-600 underline decoration-blue-200 decoration-4 underline-offset-4">Hub</span></h1>
                     </div>
                     <p className="text-slate-500 text-sm font-semibold max-w-lg leading-relaxed flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        AI-Orchestrated Command Center • 7 Systems Connected
                     </p>
                  </div>
                  
                  <div className="flex bg-white/80 backdrop-blur-xl border border-white p-2 rounded-3xl shadow-xl shadow-slate-100 items-center gap-2">
                     <div className="flex -space-x-3 px-2">
                        {[1,2,3,4].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                             {String.fromCharCode(64+i)}
                          </div>
                        ))}
                     </div>
                     <div className="h-8 w-[1px] bg-slate-200 mx-2" />
                     <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-2xl h-10 px-5 shadow-lg flex items-center gap-2">
                        Invite Team <Plus className="w-3 h-3" />
                     </Button>
                  </div>
               </header>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  {/* 📊 LEFT COLUMN: Analytics & Platform Matrix (2/3) */}
                  <div className="lg:col-span-8 space-y-10">
                     
                     {/* --- ANALYTICS DASH --- */}
                     <div className="bg-white rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 border border-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8">
                           <div className="flex gap-2">
                              <Badge className="bg-emerald-50 text-emerald-600 border-none px-3 font-bold text-[10px]">Active Session</Badge>
                              <Badge className="bg-blue-50 text-blue-600 border-none px-3 font-bold text-[10px]">Real-time Sync</Badge>
                           </div>
                        </div>

                        <div className="flex flex-col mb-8">
                           <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Growth Intelligence</h2>
                           <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Aggregate Cross-Platform Volume (Last 30 Days)</p>
                        </div>

                        <div className="grid grid-cols-3 gap-6 mb-10">
                           <div className="space-y-1 p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 group-hover:bg-blue-50/30 transition-colors">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Aggregate Reach</span>
                              <div className="text-2xl font-black text-slate-900 tracking-tight">12.4K</div>
                              <span className="text-[9px] font-bold text-emerald-500 opacity-80">+4.2%</span>
                           </div>
                           <div className="space-y-1 p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 group-hover:bg-purple-50/30 transition-colors">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI Deployments</span>
                              <div className="text-2xl font-black text-slate-900 tracking-tight">48</div>
                              <span className="text-[9px] font-bold text-blue-500 opacity-80">98.2% Accurate</span>
                           </div>
                           <div className="space-y-1 p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50 group-hover:bg-amber-50/30 transition-colors">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Interactions</span>
                              <div className="text-2xl font-black text-slate-900 tracking-tight">1.2K</div>
                           </div>
                        </div>

                        {/* --- SIMPLIFIED CSS CHART --- */}
                        <div className="h-48 relative w-full pt-6">
                           <svg viewBox="0 0 1000 200" className="w-full h-full" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              <path 
                                d="M0,180 Q250,170 500,100 T1000,40 L1000,200 L0,200 Z" 
                                fill="url(#chartGradient)" 
                              />
                              <path 
                                d="M0,180 Q250,170 500,100 T1000,40" 
                                fill="none" 
                                stroke="#3b82f6" 
                                strokeWidth="3" 
                                strokeLinecap="round"
                              />
                           </svg>
                        </div>

                     </div>

                     {/* --- PLATFORM GRID --- */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {DASHBOARD_PLATFORMS.map((platform) => (
                           <motion.div
                              key={platform.id}
                              whileHover={{ y: -8, scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setActivePlatform(platform.id)}
                              className={cn(
                                "group relative p-6 rounded-3xl cursor-pointer border border-white bg-white shadow-xl shadow-slate-100 transition-all duration-300 overflow-hidden",
                                platform.border
                              )}
                           >
                              <div className="flex flex-col gap-4 relative z-10">
                                 <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 shadow-md", platform.color)}>
                                    {platform.icon}
                                 </div>
                                 <div>
                                    <h3 className="text-xl font-black text-slate-900 mb-1">{platform.name}</h3>
                                    <p className="text-slate-400 text-xs font-bold leading-relaxed pr-4">{platform.desc}</p>
                                 </div>
                                 
                                 <div className="pt-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-blue-600">
                                      Launch <ChevronRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-300">LIVE SYNC</span>
                                 </div>
                              </div>
                              <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity", platform.color)}>
                                 {platform.icon}
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  </div>

                  {/* 🤖 RIGHT COLUMN: Zynco Intelligence (1/3) */}
                  <div className="lg:col-span-4 space-y-8">
                     <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden border border-slate-800 h-full">
                        <div className="absolute top-0 right-0 p-8">
                           <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
                        </div>

                        <div className="flex flex-col mb-10">
                           <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Zynco Orchestration</span>
                           </div>
                           <h2 className="text-3xl font-black tracking-tight leading-tight">AI Intelligence <br/>Insights</h2>
                        </div>

                        <div className="space-y-6">
                           <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                              <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Current Insight</h4>
                              <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                                 Detected high interaction affinity on <b>Instagram</b>. Recommend active AI engagement for the next 2 hours.
                              </p>
                              <Button className="mt-6 w-full h-10 bg-blue-600 hover:bg-blue-700 font-bold text-[10px] rounded-xl shadow-lg shadow-blue-500/20">Deploy Engagement AI</Button>
                           </div>
                        </div>


                        <div className="mt-12 pt-10 border-t border-white/5">
                           <div className="flex justify-between items-center bg-white/5 p-4 rounded-3xl border border-white/10">
                              <div>
                                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">System Health</div>
                                 <div className="text-lg font-black text-white">Full Capacity</div>
                              </div>
                              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-400">
                                 <ShieldCheck className="w-6 h-6" />
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <footer className="pt-10 flex flex-col md:flex-row items-center justify-between gap-8 border-t border-slate-100/50">
                  <div className="flex gap-10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                     <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" /> Cross-Platform Sync: OK</span>
                     <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" /> Database Uptime: 99.9%</span>
                     <span className="flex items-center gap-2 text-slate-300">v2.4.0 Kernel</span>
                  </div>
                  <div className="flex gap-4">
                     <Button variant="ghost" className="text-slate-500 hover:text-slate-900 font-bold text-xs">Privacy Protocol</Button>
                     <Button variant="ghost" className="text-slate-500 hover:text-slate-900 font-bold text-xs">Security Audit</Button>
                  </div>
               </footer>
            </div>
          </motion.div>
        ) : (
          <motion.main 
            key="platform"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col min-w-0 bg-white h-screen overflow-hidden"
          >
            <header className="h-14 border-b border-slate-100 bg-white sticky top-0 z-50 px-6 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setActivePlatform("dashboard")}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="font-bold text-[10px] uppercase tracking-wider">Back</span>
                </Button>
                <div className="h-6 w-[1px] bg-slate-200 mx-1" />
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm",
                    activePlatform === 'whatsapp' ? 'bg-emerald-500' : 
                    activePlatform === 'instagram' ? 'bg-pink-500' : 
                    activePlatform === 'twitter' ? 'bg-slate-900' : 
                    activePlatform === 'linkedin' ? 'bg-blue-600' : 
                    activePlatform === 'gmail' ? 'bg-red-500' : 'bg-primary'
                  )}>
                    {activePlatform === 'whatsapp' ? <MessageSquare className="w-4 h-4" /> : 
                     activePlatform === 'instagram' ? <Instagram className="w-4 h-4" /> : 
                     activePlatform === 'twitter' ? <Twitter className="w-4 h-4" /> : 
                     activePlatform === 'linkedin' ? <Linkedin className="w-4 h-4" /> : 
                     activePlatform === 'all' ? <Sparkles className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                  </div>
                  <h2 className="text-lg font-bold tracking-tight capitalize">{activePlatform === 'all' ? 'Unified Feed' : String(activePlatform)}</h2>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="relative hidden lg:block w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Search interactions..." 
                    className="bg-slate-50 border-slate-200 pl-10 h-9 rounded-lg focus:ring-blue-500/20 text-xs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" className="rounded-lg h-9 w-9 border-slate-200 text-slate-500">
                    <Bell className="w-4 h-4" />
                  </Button>
                  <Button size="icon" className="rounded-lg h-9 w-9 bg-blue-600 hover:bg-blue-700 shadow-md">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </header>

            <ScrollArea className="flex-1">
              <div className="h-full">
                {activePlatform === 'gmail' && (
                  <div className="h-[calc(100vh-3.5rem)]">
                    <EmailClassifierEditor agentId={String(agentId || '')} />
                  </div>
                )}

                {activePlatform === 'twitter' && (
                  <div className="flex flex-col bg-slate-50/50 h-[calc(100vh-3.5rem)] overflow-hidden">
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                       {/* Left: Compose */}
                       <div className="w-full lg:w-1/2 p-6 space-y-6 overflow-y-auto pb-32">
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Draft a Tweet</h3>
                                    {twitterToken ? (
                                        <Badge className="bg-sky-50 text-sky-600 border-none px-2 font-bold text-[9px]">CONNECTED</Badge>
                                    ) : (
                                        <Link href="/api/twitter/auth">
                                            <Badge variant="outline" className="cursor-pointer text-[9px] font-bold border-red-100 text-red-500 bg-red-50/30 hover:bg-red-100 hover:text-red-700 transition-colors">DISCONNECTED (CLICK TO CONNECT)</Badge>
                                        </Link>
                                    )}
                                </div>
                                <textarea 
                                    className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none text-sm placeholder:text-slate-400 resize-none min-h-[120px] transition-all"
                                    placeholder={twitterToken ? "What's happening?" : "Authorize X/Twitter to start tweeting..."}
                                    value={postContent}
                                    disabled={!twitterToken}
                                    onChange={(e) => setPostContent(e.target.value)}
                                />
                                
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                   <div className="flex-1 flex gap-2">
                                       <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-10 rounded-xl border-slate-200 text-slate-500 gap-2 hover:bg-slate-50 px-4"
                                          onClick={() => document.getElementById('twitter-image-upload')?.click()}
                                       >
                                          <Plus className="w-4 h-4" /> Media
                                       </Button>
                                       <input 
                                          id="twitter-image-upload"
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                      setPostImage(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                              }
                                          }}
                                       />
                                       {postImage && (
                                           <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => setPostImage(null)}
                                              className="h-10 text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                                           >
                                              Clear
                                           </Button>
                                       )}
                                   </div>

                                   <div className="flex gap-2">
                                       <Button 
                                          onClick={handleAIDraft}
                                          disabled={isAiLoading || !postContent}
                                          variant="outline"
                                          className="h-10 rounded-xl border-sky-200 text-sky-600 bg-sky-50 hover:bg-sky-100 font-bold px-4 gap-2"
                                       >
                                          {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                          <span>AI Draft</span>
                                       </Button>
                                       <Button 
                                          onClick={handlePost}
                                          disabled={isPosting || !postContent || !twitterToken}
                                          className="h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold px-6"
                                       >
                                          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Post"}
                                       </Button>
                                   </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Live Tweet Preview</h3>
                                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                    <div className="p-4 flex gap-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm">Z</div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">Zynco Hub User</p>
                                            <p className="text-[10px] text-slate-500">@zynco_hub · Just now</p>
                                        </div>
                                    </div>
                                    <div className="px-4 pb-4">
                                        <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap min-h-[20px]">
                                            {postContent || "Your tweet content will appear here..."}
                                        </p>
                                    </div>
                                    {postImage && (
                                        <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center border-t border-slate-50 max-h-[350px]">
                                            <img src={postImage} alt="Post preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className="p-3 bg-white flex items-center justify-between px-6 text-slate-400 border-t border-slate-100">
                                        <div className="flex items-center gap-1 text-[11px] font-bold hover:text-sky-500 transition-colors cursor-pointer"><MessageCircle className="w-4 h-4" /></div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold hover:text-green-500 transition-colors cursor-pointer"><Repeat className="w-4 h-4" /></div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold hover:text-pink-500 transition-colors cursor-pointer"><Heart className="w-4 h-4" /></div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold hover:text-sky-500 transition-colors cursor-pointer"><Share className="w-4 h-4" /></div>
                                    </div>
                                </div>
                            </div>

                            {!twitterToken && (
                                <Link href="/api/twitter/auth" className="block pt-4">
                                    <div className="bg-slate-900 text-white p-6 rounded-2xl text-center shadow-lg shadow-slate-900/20 hover:scale-[1.01] transition-transform cursor-pointer">
                                        <Twitter className="w-8 h-8 mx-auto mb-3 text-sky-400" />
                                        <h4 className="font-bold">Establish Connection</h4>
                                        <p className="text-[10px] opacity-80 font-medium uppercase tracking-widest mt-1">X/Twitter Integration</p>
                                    </div>
                                </Link>
                            )}
                       </div>

                       {/* Right: History */}
                       <div className="w-full lg:w-1/2 p-6 border-l border-slate-100 bg-white flex flex-col shrink-0 overflow-y-auto pb-32">
                            <div className="flex items-center gap-2 mb-6">
                                <Twitter className="w-5 h-5 text-sky-500" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Your Tweet History</h3>
                            </div>
                            
                            <div className="space-y-4">
                                {isLoadingFeed ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                                    </div>
                                ) : twitterFeed.length === 0 ? (
                                    <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-sm text-slate-500 font-medium">No previous tweets found.</p>
                                    </div>
                                ) : (
                                    twitterFeed.map((item, idx) => {
                                        const isExpanded = expandedTwitterPostIds.includes(item.id);
                                        return (
                                        <div 
                                            key={idx} 
                                            onClick={() => setExpandedTwitterPostIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                                            className="p-4 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors cursor-pointer group shadow-sm hover:shadow-md"
                                        >
                                           <div className="flex justify-between items-start">
                                               <div className="flex flex-col">
                                                   <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                      {new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                   </span>
                                                   <span className="text-sm font-bold text-slate-800 mt-1 line-clamp-1">{item.title || "Twitter Update"}</span>
                                               </div>
                                               <Badge className="bg-sky-50 text-sky-600 border-none text-[9px] hover:bg-sky-50 shrink-0 ml-2">{item.status}</Badge>
                                           </div>
                                           {isExpanded && (
                                               <div className="pt-3 mt-1 border-t border-slate-100/80">
                                                   <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap flex-1">{item.content}</p>
                                               </div>
                                           )}
                                           <div className="flex justify-between items-center mt-1">
                                               {item.mediaUrl ? (
                                                  <div className="text-[10px] font-bold text-sky-500 flex items-center gap-1">
                                                     <Sparkles className="w-3 h-3" /> Attached Media
                                                  </div>
                                               ) : <div />}
                                               <span className="text-[10px] font-bold text-slate-400 group-hover:text-sky-500 transition-colors">
                                                   {isExpanded ? "Show Less" : "View Details"}
                                               </span>
                                           </div>
                                        </div>
                                    )})
                                )}
                                
                                <div className="pt-4 text-center">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-8">Data synced directly from Unified Database</p>
                                </div>
                            </div>
                       </div>
                    </div>
                  </div>
                )}

                {activePlatform === 'whatsapp' && (
                  waEngineStatus !== 'READY' ? (
                      <div className="bg-slate-50 min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
                          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-lg w-full">
                              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm relative overflow-hidden group">
                                  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-blue-600 group-hover:h-full transition-all duration-700 opacity-10"></div>
                                  <Bot className="w-8 h-8 relative z-10" />
                              </div>
                              <h3 className="font-bold text-xl text-slate-900 mb-2 text-center">Connect Whapi.cloud Hub</h3>
                              <p className="text-sm text-slate-500 mb-8 leading-relaxed text-center">
                                Use the professional Whapi.cloud gateway for stable, cloud-hosted WhatsApp automation. No local browser required.
                              </p>
                              
                              <div className="space-y-4">
                                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Step 1: Set Webhook in Whapi Panel</p>
                                      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                          <code className="text-xs text-blue-600 font-mono flex-1 overflow-hidden truncate">
                                              {window.location.origin}/api/whatsapp/webhook
                                          </code>
                                          <Button 
                                              variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 shrink-0"
                                              onClick={() => {
                                                  navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`);
                                                  toast.success("Webhook URL copied");
                                              }}
                                          >
                                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                                          </Button>
                                      </div>
                                  </div>

                                  <div className="space-y-2">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 2: Enter Whapi API Token</p>
                                      <Input 
                                          placeholder="Enter your Whapi Bearer Token" 
                                          className="h-12 bg-white border-slate-200 focus:ring-blue-500 rounded-xl px-4 text-sm font-semibold shadow-sm"
                                          type="password"
                                          id="whapi-token-input"
                                      />
                                  </div>

                                  <Button 
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 h-12 rounded-xl font-bold transition-transform active:scale-[0.98] mt-2 group"
                                      onClick={() => {
                                          const token = (document.getElementById('whapi-token-input') as HTMLInputElement)?.value;
                                          if (token) {
                                              localStorage.setItem('whapi_token', token);
                                              setWaEngineStatus("READY");
                                              toast.success("WhatsApp Cloud Connected Successfully");
                                          } else {
                                              toast.error("Please enter a valid API token");
                                          }
                                      }}
                                  >
                                      <Zap className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                                      Authorize Cloud Connection
                                  </Button>

                                  <div className="pt-2 text-center">
                                      <a href="https://panel.whapi.cloud/integrations" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline font-bold transition-all">Get your Whapi.cloud token &rarr;</a>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col bg-slate-50/50 h-[calc(100vh-3.5rem)] overflow-hidden">
                          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                              {/* Left Pane: Rule configuration */}
                              <div className="w-full lg:w-1/2 p-6 space-y-6 overflow-y-auto pb-32">
                                 <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                         <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                            <div className="relative">
                                                <Bot className="w-5 h-5 text-emerald-500 shadow-sm relative z-10" />
                                                <div className="absolute inset-0 bg-emerald-400 rounded-full blur animate-ping opacity-20"></div>
                                            </div>
                                            WhatsApp AI Auto-Responder
                                         </h3>
                                         <Badge 
                                            variant="outline"
                                            className="cursor-pointer bg-blue-50 border-none text-blue-600 font-bold text-[9px] shadow-sm hover:bg-emerald-50 hover:text-emerald-500 transition-colors px-2 py-1"
                                            onClick={() => {
                                                toast.success("Mock Engine Re-Synced");
                                            }}
                                         >
                                            ZYNCO CORE ONLINE
                                         </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-6 font-medium">Create dynamic, role-based AI automations that instantly reply to inbound WhatsApp messages when connected to the data stream.</p>
                                    
                                    <div className="space-y-5">
                                       <div>
                                           <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">1. Trigger Condition</label>
                                           <select 
                                              className="w-full h-11 rounded-xl border border-slate-200 text-sm shadow-sm bg-slate-50/50 focus:border-emerald-500 focus:ring-emerald-500/20 px-3 outline-none"
                                              value={ruleTrigger}
                                              onChange={(e) => setRuleTrigger(e.target.value)}
                                           >
                                               <option>When receiving ANY new message</option>
                                               <option>When sender is UNKNOWN</option>
                                               <option>When message contains KEYWORDS</option>
                                           </select>
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-700 uppercase mb-2 block">2. Role / Persona Setting</label>
                                           <select 
                                              className="w-full h-11 rounded-xl border border-slate-200 text-sm shadow-sm bg-slate-50/50 focus:border-emerald-500 focus:ring-emerald-500/20 px-3 outline-none"
                                              value={rulePersona}
                                              onChange={(e) => setRulePersona(e.target.value)}
                                           >
                                               <option>Friendly Greeting Assistant</option>
                                               <option>Strict Support Agent</option>
                                               <option>Sales Representative</option>
                                           </select>
                                       </div>
                                       <div>
                                           <label className="text-xs font-bold text-slate-700 uppercase mb-2 block flex justify-between">
                                               <span>3. AI Base Instructions (Prompt)</span>
                                           </label>
                                           <textarea 
                                              className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm shadow-sm placeholder:text-slate-400 resize-none min-h-[120px] transition-all"
                                              placeholder="e.g., You are a greeting bot for Zynco. Always welcome them warmly, ask for their name, and tell them an agent will be with them shortly."
                                              value={postContent}
                                              onChange={(e) => setPostContent(e.target.value)}
                                           />
                                       </div>
                                       <Button 
                                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-emerald-500/20 gap-2 transition-transform active:scale-[0.98]"
                                          onClick={async () => {
                                              if (!postContent) return toast.error("Write a base prompt first!");
                                              toast.loading("Deploying Rule Matrix to Central Engine...");
                                              await fetch('/api/whatsapp/rule', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ trigger: ruleTrigger, persona: rulePersona, prompt: postContent })
                                              });
                                              toast.success("AI Automation Rule Live Subscribed!");
                                              setPostContent("");
                                          }}
                                       >
                                          <Zap className="w-4 h-4 fill-white flex-shrink-0" /> Commit Automation Matrix
                                       </Button>
                                    </div>
                                 </div>
                              </div>

                              {/* Right Pane: Active Workflows & Live Logs */}
                              <div className="w-full lg:w-1/2 p-6 bg-slate-50/80 overflow-y-auto pb-32 border-l border-slate-200">
                                 <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Active Workflows</h3>
                                 <div className="space-y-3">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between cursor-pointer">
                                       <div>
                                           <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">General Auto-Greeting</h4>
                                           <p className="text-xs text-slate-500 mt-0.5">Target: All Unknown Senders</p>
                                       </div>
                                       <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50/50 text-[10px] px-2 py-1 shadow-sm"><Play className="w-3 h-3 mr-1 fill-emerald-600" /> RUNNING</Badge>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 opacity-60 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                                       <div>
                                           <h4 className="font-bold text-sm text-slate-700">Out-of-Office Response</h4>
                                           <p className="text-xs text-slate-500 mt-0.5">Target: After 6 PM</p>
                                       </div>
                                       <Badge variant="outline" className="border-slate-200 text-slate-500 bg-slate-50/50 text-[10px] px-2 py-1"><Pause className="w-3 h-3 mr-1 fill-slate-500" /> PAUSED</Badge>
                                    </div>
                                 </div>

                                 <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mt-10 mb-4 flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-indigo-500" /> Execution Logs
                                 </h3>
                                 <div className="bg-[#0f172a] rounded-xl p-5 font-mono text-[11px] text-emerald-400 h-[240px] overflow-y-auto space-y-3 shadow-inner border border-slate-800">
                                    <p><span className="text-slate-500 mr-2">[10:42:01]</span> <span className="text-slate-300">System:</span> Connected to whatsapp-web.js session via data bridge.</p>
                                    <p><span className="text-slate-500 mr-2">[10:43:15]</span> <span className="text-indigo-400 font-bold">INBOUND:</span> +1 415-555-0198 <span className="text-slate-300">"Hello, anyone there?"</span></p>
                                    <p><span className="text-slate-500 mr-2">[10:43:16]</span> <span className="text-slate-300">System:</span> Match strict rule: <span className="text-emerald-300">General Auto-Greeting</span>.</p>
                                    <p><span className="text-slate-500 mr-2">[10:43:18]</span> <span className="text-amber-400 font-bold">AI DISPATCH:</span> <span className="text-amber-100">"Hi there! Welcome to Zynco. How can we help you today?"</span></p>
                                    <p><span className="text-slate-500 mr-2">[10:43:18]</span> <span className="text-slate-300">System:</span> Message successfully relayed to whatsapp client.</p>
                                    <div className="flex items-center gap-2 pt-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <p className="text-slate-500 italic">Engine idle, listening for new socket events...</p>
                                    </div>
                                 </div>
                              </div>
                          </div>
                      </div>
                  )
                 )}

                {activePlatform === 'all' && (
                  <>
                    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto pb-32">
                      <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Intelligence Stream</h2>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Cross-Platform AI Analysis active</p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className="bg-blue-600 text-white border-none px-4 py-1.5 rounded-xl font-bold shadow-lg shadow-blue-500/20 text-[10px]">ALL RECENT <ChevronRight className="w-3 h-3 ml-1" /></Badge>
                          </div>
                        </div>

                        <div className="space-y-6">
                          {filteredMessages.map((msg, idx) => (
                            <motion.div 
                              key={msg.id} 
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="group relative p-6 rounded-[28px] bg-white border border-slate-100 hover:border-blue-200 hover:shadow-2xl hover:shadow-slate-200/50 transition-all duration-500 cursor-pointer flex flex-col md:flex-row gap-6"
                            >
                              {/* Platform Identity */}
                              <div className="relative shrink-0">
                                <Avatar className="w-14 h-14 border-2 border-white shadow-xl">
                                  <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 font-black text-lg">
                                    {msg.user.name[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={cn(
                                  "absolute -bottom-1 -right-1 w-7 h-7 rounded-lg border-2 border-white flex items-center justify-center text-white shadow-lg",
                                  msg.platform === 'whatsapp' ? 'bg-emerald-500' : 
                                  msg.platform === 'instagram' ? 'bg-pink-500' : 
                                  msg.platform === 'twitter' ? 'bg-slate-900' : 
                                  msg.platform === 'linkedin' ? 'bg-blue-600' : 'bg-red-500'
                                )}>
                                  {msg.platform === 'whatsapp' ? <MessageSquare className="w-3 h-3" /> : 
                                   msg.platform === 'instagram' ? <Instagram className="w-3 h-3" /> : 
                                   msg.platform === 'twitter' ? <Twitter className="w-3 h-3" /> : 
                                   msg.platform === 'linkedin' ? <Linkedin className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                                </div>
                              </div>

                              <div className="flex-1 min-w-0 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <span className="font-black text-lg text-slate-900 tracking-tight">{msg.user.name}</span>
                                     <Badge className="bg-blue-50 text-blue-600 border-none font-bold text-[9px] uppercase tracking-widest px-2">RECENT Interaction</Badge>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-300">12m ago</span>
                                </div>

                                <p className="text-slate-600 text-sm font-medium leading-relaxed mb-4">
                                   {String(msg.content || '')}
                                </p>

                                {/* 🤖 AI ANALYSIS PLATE */}
                                <div className="bg-slate-50/80 backdrop-blur-md rounded-2xl p-4 border border-slate-100 relative overflow-hidden group-hover:bg-blue-50/50 transition-colors">
                                   <div className="flex items-start gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm shrink-0">
                                         <Sparkles className="w-5 h-5 text-amber-500 shadow-sm" />
                                      </div>
                                      <div className="flex-1">
                                         <div className="flex items-center gap-2 mb-1">
                                            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Zynco AI Analysis</h4>
                                            <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black px-1.5">POSITIVE SENTIMENT</Badge>
                                            <Badge className="bg-amber-100 text-amber-700 border-none text-[8px] font-black px-1.5">TASK DETECTED</Badge>
                                         </div>
                                         <p className="text-[11px] font-bold text-slate-500 leading-relaxed italic">
                                            Agent detected an opportunity for high-value engagement. Recommend immediate personalized response to secure lead.
                                         </p>
                                      </div>
                                   </div>
                                </div>

                                {/* ACTION BUTTONS */}
                                <div className="flex flex-wrap gap-2 pt-2">
                                   <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-[10px] h-8 px-4 shadow-lg flex items-center gap-2">
                                      <SendHorizontal className="w-3.5 h-3.5" /> Draft AI Response
                                   </Button>
                                   <Button size="sm" variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-[10px] h-8 px-4 flex items-center gap-2">
                                      <Calendar className="w-3.5 h-3.5" /> Schedule Follow-up
                                   </Button>
                                   <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-900 font-bold text-[10px] h-8 px-2">
                                      Dismiss
                                   </Button>
                                </div>
                              </div>
                              
                              {/* Hover Focus Indicator */}
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-blue-600 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.div>
                          ))}
                        </div>

                        <div className="pt-10 flex flex-col items-center gap-4">
                           <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
                           <p className="text-xs font-black text-slate-300 uppercase tracking-[0.3em]">Syncing Orchestration Cache</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              {activePlatform === 'linkedin' && (
                  <div className="flex flex-col bg-slate-50/50 h-[calc(100vh-3.5rem)] overflow-hidden">
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                       {/* Left: Compose & Connection */}
                       <div className="w-full lg:w-1/2 p-6 space-y-6 overflow-y-auto pb-32">
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Create Feed Post</h3>
                                    {linkedinToken ? (
                                        <Badge className="bg-blue-50 text-blue-600 border-none px-2 font-bold text-[9px]">CONNECTED</Badge>
                                    ) : (
                                        <Link href="/api/linkedin/auth">
                                            <Badge variant="outline" className="cursor-pointer text-[9px] font-bold border-red-100 text-red-500 bg-red-50/30 hover:bg-red-100 hover:text-red-700 transition-colors">DISCONNECTED (CLICK TO CONNECT)</Badge>
                                        </Link>
                                    )}
                                </div>
                                <textarea 
                                    className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm placeholder:text-slate-400 resize-none min-h-[140px] transition-all"
                                    placeholder={linkedinToken ? "Draft your professional update..." : "Authorize LinkedIn to start sharing..."}
                                    value={postContent}
                                    onChange={(e) => setPostContent(e.target.value)}
                                />
                                
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                   <div className="flex-1 flex gap-2">
                                       <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-10 rounded-xl border-slate-200 text-slate-500 gap-2 hover:bg-slate-50 px-4"
                                          onClick={() => document.getElementById('linkedin-image-upload')?.click()}
                                       >
                                          <Plus className="w-4 h-4" /> Image
                                       </Button>
                                       <input 
                                          id="linkedin-image-upload"
                                          type="file"
                                          accept="image/*"
                                          className="hidden"
                                          onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                      setPostImage(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                              }
                                          }}
                                       />
                                       {postImage && (
                                           <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              onClick={() => setPostImage(null)}
                                              className="h-10 text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
                                           >
                                              Clear
                                           </Button>
                                       )}
                                   </div>

                                   <div className="flex gap-2">
                                       <Button 
                                          onClick={handleAIDraft}
                                          disabled={isAiLoading || !postContent}
                                          variant="outline"
                                          className="h-10 rounded-xl border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 font-bold px-4 gap-2"
                                       >
                                          {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                          <span>AI Draft</span>
                                       </Button>
                                       <Button 
                                          onClick={handlePost}
                                          disabled={isPosting || !postContent || !linkedinToken}
                                          className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6"
                                       >
                                          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
                                       </Button>
                                   </div>
                                </div>
                            </div>

                            {/* Live Preview */}
                            <div className="space-y-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Live Feed Preview</span>
                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="p-4 flex gap-3">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-sm">Z</div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900">Zynco Hub User</p>
                                            <p className="text-[10px] text-slate-500">Automated Intelligence Platform · Just now</p>
                                        </div>
                                    </div>
                                    <div className="px-4 pb-4">
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap min-h-[20px]">
                                            {postContent || "Your post content will appear here..."}
                                        </p>
                                    </div>
                                    {postImage && (
                                        <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center border-t border-slate-50 max-h-[350px]">
                                            <img src={postImage} alt="Post preview" className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                    <div className="p-3 bg-slate-50 flex items-center gap-6 text-slate-400 border-t border-slate-100">
                                        <div className="flex items-center gap-1 text-[11px] font-bold"><Heart className="w-3 h-3" /> Like</div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold"><MessageCircle className="w-3 h-3" /> Comment</div>
                                        <div className="flex items-center gap-1 text-[11px] font-bold"><Share className="w-3 h-3" /> Repost</div>
                                    </div>
                                </div>
                            </div>

                            {!linkedinToken && (
                                <Link href="/api/linkedin/auth" className="block pt-4">
                                    <div className="bg-blue-600 text-white p-6 rounded-2xl text-center shadow-lg shadow-blue-500/20 hover:scale-[1.01] transition-transform cursor-pointer">
                                        <Linkedin className="w-8 h-8 mx-auto mb-3" />
                                        <h4 className="font-bold">Establish Connection</h4>
                                        <p className="text-[10px] opacity-80 font-medium uppercase tracking-widest mt-1">LinkedIn Standard API</p>
                                    </div>
                                </Link>
                            )}
                       </div>

                       {/* Right: Post History */}
                       <div className="w-full lg:w-1/2 p-6 border-l border-slate-100 bg-white flex flex-col shrink-0 overflow-y-auto pb-32">
                            <div className="flex items-center gap-2 mb-6">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Your Post History</h3>
                            </div>
                            
                            <div className="space-y-4">
                                {isLoadingFeed ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                                    </div>
                                ) : linkedinFeed.length === 0 ? (
                                    <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <p className="text-sm text-slate-500 font-medium">No previous posts found.</p>
                                    </div>
                                ) : (
                                    linkedinFeed.map((item, idx) => {
                                        const isExpanded = expandedPostIds.includes(item.id);
                                        return (
                                        <div 
                                            key={idx} 
                                            onClick={() => setExpandedPostIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                                            className="p-4 flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors cursor-pointer group shadow-sm hover:shadow-md"
                                        >
                                           <div className="flex justify-between items-start">
                                               <div className="flex flex-col">
                                                   <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                      {new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                   </span>
                                                   <span className="text-sm font-bold text-slate-800 mt-1 line-clamp-1">{item.title || "LinkedIn Update"}</span>
                                               </div>
                                               <Badge className="bg-emerald-50 text-emerald-600 border-none text-[9px] hover:bg-emerald-50 shrink-0 ml-2">{item.status}</Badge>
                                           </div>
                                           {isExpanded && (
                                               <div className="pt-3 mt-1 border-t border-slate-100/80">
                                                   <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap flex-1">{item.content}</p>
                                               </div>
                                           )}
                                           <div className="flex justify-between items-center mt-1">
                                               {item.mediaUrl ? (
                                                  <div className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                                                     <Sparkles className="w-3 h-3" /> Attached Media
                                                  </div>
                                               ) : <div />}
                                               <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                                                   {isExpanded ? "Show Less" : "View Details"}
                                               </span>
                                           </div>
                                        </div>
                                    )})
                                )}
                                
                                <div className="pt-4 text-center">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-8">Data synced directly from Unified Database</p>
                                </div>
                            </div>
                       </div>
                    </div>
                  </div>
                )}

                {activePlatform === 'instagram' && (
                  <div className="flex flex-col bg-slate-50/50 h-[calc(100vh-3.5rem)] overflow-hidden">
                    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                       {/* Left: Compose */}
                       <div className="w-full lg:w-1/2 p-6 space-y-6 overflow-y-auto pb-32">
                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Draft a Post</h3>
                                    {instagramToken ? (
                                        <Badge 
                                            variant="outline"
                                            className="cursor-pointer bg-fuchsia-50 text-fuchsia-600 border-none px-2 font-bold text-[9px] hover:bg-red-50 hover:text-red-500 transition-colors"
                                            onClick={() => {
                                                setInstagramToken(null);
                                                localStorage.removeItem('ayrshare_key');
                                                toast.info("Ayrshare API Key cleared.");
                                            }}
                                            title="Click to Disconnect"
                                        >
                                            CONNECTED (CLICK TO DISCONNECT)
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[9px] font-bold border-red-100 text-red-500 bg-red-50/30">DISCONNECTED</Badge>
                                    )}
                                </div>
                                <textarea 
                                    className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-fuchsia-500/20 focus:border-fuchsia-500 outline-none text-sm placeholder:text-slate-400 resize-none min-h-[120px] transition-all"
                                    placeholder={instagramToken ? "Compose a visually inspiring caption..." : "Authorize Instagram to start composing..."}
                                    value={postContent}
                                    disabled={!instagramToken}
                                    onChange={(e) => setPostContent(e.target.value)}
                                />
                                
                                <div className="mt-4 flex flex-wrap items-center gap-3">
                                   <div className="flex-1 flex gap-2">
                                       <Button 
                                          variant="outline" 
                                          size="sm" 
                                          className="h-10 rounded-xl border-slate-200 text-slate-500 gap-2 hover:bg-slate-50 px-4"
                                          onClick={() => document.getElementById('instagram-image-upload')?.click()}
                                       >
                                          <Plus className="w-4 h-4" /> Add Media
                                       </Button>
                                       <input 
                                          id="instagram-image-upload"
                                          type="file"
                                          accept="image/*,video/*"
                                          className="hidden"
                                          onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                      setPostImage(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                              }
                                          }}
                                       />
                                       {postImage && (
                                          <Button 
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPostImage(null)}
                                            className="h-10 text-red-500 hover:bg-red-50"
                                          >
                                            Clear Media
                                          </Button>
                                       )}
                                   </div>

                                   <div className="flex gap-2">
                                       <Button 
                                          onClick={handleAIDraft}
                                          disabled={isAiLoading || !postContent || !instagramToken}
                                          variant="outline"
                                          className="h-10 rounded-xl border-fuchsia-200 text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100 font-bold px-4 gap-2"
                                       >
                                          {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                          <span>AI Draft</span>
                                       </Button>
                                       <Button 
                                          onClick={handlePost}
                                          disabled={isPosting || !postContent || !instagramToken || !postImage}
                                          className="h-10 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold px-6 border-0"
                                       >
                                          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publish"}
                                       </Button>
                                   </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Post Preview</h3>
                                <div className="bg-white border border-slate-200 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden max-w-[360px] mx-auto border-x-4 border-t-8 border-b-[16px] border-slate-800">
                                    <div className="p-3 flex items-center justify-between border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                                                <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-[10px]">ZH</div>
                                            </div>
                                            <p className="font-bold text-xs text-slate-900">zynco_hub</p>
                                        </div>
                                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                    </div>
                                    <div className="aspect-square bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                        {postImage ? (
                                            <img src={postImage} alt="Post preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center p-6 text-slate-400">
                                                <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                                <p className="text-xs font-medium">A visual media asset is required</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 bg-white">
                                        <div className="flex gap-4 mb-3">
                                            <Heart className="w-5 h-5 text-slate-900" />
                                            <MessageCircle className="w-5 h-5 text-slate-900" style={{transform: "scaleX(-1)"}} />
                                            <Send className="w-5 h-5 text-slate-900" />
                                        </div>
                                        <p className="text-[13px] text-slate-900 whitespace-pre-wrap">
                                            <span className="font-bold mr-2">zynco_hub</span>
                                            {postContent || "Your caption will appear here..."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            {!instagramToken && (
                                <div className="bg-gradient-to-r from-pink-500 to-purple-600 p-6 rounded-2xl text-center shadow-lg shadow-pink-500/20 pt-4 mt-4">
                                    <Instagram className="w-8 h-8 mx-auto mb-3 text-white/90" />
                                    <h4 className="font-bold text-white mb-1">Connect Ayrshare API</h4>
                                    <p className="text-[10px] text-white/80 font-medium uppercase tracking-widest mb-4">Paste your API Key Below</p>
                                    <div className="flex flex-col gap-3 max-w-[280px] mx-auto">
                                        <Input 
                                            type="password" 
                                            placeholder="Enter API Key (e.g. C6E11E...)" 
                                            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-white text-center h-11 rounded-xl"
                                            value={tempInstagramKey}
                                            onChange={(e) => setTempInstagramKey(e.target.value)}
                                        />
                                        <Button 
                                            onClick={() => {
                                                if (tempInstagramKey.trim()) {
                                                    setInstagramToken(tempInstagramKey.trim());
                                                    localStorage.setItem('ayrshare_key', tempInstagramKey.trim());
                                                    toast.success("Ayrshare API Key securely saved.");
                                                }
                                            }}
                                            className="w-full bg-white text-pink-600 hover:bg-pink-50 font-bold h-11 rounded-xl shadow-md"
                                        >
                                            Save & Connect
                                        </Button>
                                    </div>
                                </div>
                            )}
                       </div>

                       {/* Right: History */}
                       <div className="w-full lg:w-1/2 p-6 border-l border-slate-100 bg-white flex flex-col shrink-0 overflow-y-auto pb-32">
                            <div className="flex items-center gap-2 mb-6">
                                <Instagram className="w-5 h-5 text-pink-500" />
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Visual Gallery</h3>
                            </div>
                            
                            <div className="space-y-4">
                                {isLoadingFeed ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                                    </div>
                                ) : instagramFeed.length === 0 ? (
                                    <div className="text-center p-8 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                        <p className="text-sm text-slate-500">Your visual gallery is empty.</p>
                                    </div>
                                ) : (
                                    instagramFeed.map((post) => {
                                        const isExpanded = expandedInstagramPostIds.includes(post.id);
                                        return (
                                        <div key={post.id} className="group border border-slate-100 bg-white p-5 rounded-2xl hover:border-pink-200 hover:shadow-md hover:shadow-pink-500/5 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex gap-3">
                                                    {post.mediaUrl && post.mediaUrl !== 'UPLOADED_BINARY' ? (
                                                        <img src={post.mediaUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shrink-0 shadow-sm" />
                                                    )}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{post.title}</h4>
                                                        <p className="text-[10px] text-slate-400">{new Date(post.timestamp).toLocaleDateString()} • {new Date(post.timestamp).toLocaleTimeString()}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[9px] bg-slate-50 font-bold border-slate-200 text-slate-500">PUBLISHED</Badge>
                                            </div>
                                            <div 
                                                className={`text-sm text-slate-600 bg-slate-50/50 p-4 rounded-xl whitespace-pre-wrap ${!isExpanded && "line-clamp-2"}`}
                                            >
                                                {post.content}
                                            </div>
                                            <div 
                                                className="mt-2 text-center cursor-pointer pt-2"
                                                onClick={() => setExpandedInstagramPostIds(prev => 
                                                    prev.includes(post.id) ? prev.filter(id => id !== post.id) : [...prev, post.id]
                                                )}
                                            >
                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-pink-500 transition-colors">
                                                    {isExpanded ? "Collapse" : "View Full Caption"}
                                                </span>
                                            </div>
                                        </div>
                                    )})
                                )}
                                <div className="pt-4 text-center">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest px-8">Media Synced via Ayrshare API / DB</p>
                                </div>
                            </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.main>
        )}
      </AnimatePresence>

      <ZyncoChatbot />
    </div>
  );
}
