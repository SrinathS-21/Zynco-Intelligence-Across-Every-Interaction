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
  Loader2,
  Calendar,
  SendHorizontal
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

const PLATFORMS = [
  { id: "all", name: "All Flows", icon: <LayoutDashboard className="w-5 h-5" />, color: "text-blue-500" },
  { id: "whatsapp", name: "WhatsApp", icon: <MessageSquare className="w-5 h-5" />, color: "text-green-500" },
  { id: "instagram", name: "Instagram", icon: <Instagram className="w-5 h-5" />, color: "text-pink-500" },
  { id: "twitter", name: "Twitter (X)", icon: <Twitter className="w-5 h-5" />, color: "text-white" },
  { id: "linkedin", name: "LinkedIn", icon: <Linkedin className="w-5 h-5" />, color: "text-blue-600" },
  { id: "gmail", name: "Gmail", icon: <Mail className="w-5 h-5" />, color: "text-red-500" },
  { id: "slack", name: "Slack", icon: <Slack className="w-5 h-5" />, color: "text-indigo-400" },
  { id: "github", name: "GitHub", icon: <Github className="w-5 h-5" />, color: "text-neutral-400" },
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

export default function UnifiedDashboardView() {
  const [activePlatform, setActivePlatform] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postRecipient, setPostRecipient] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [showScheduler, setShowScheduler] = useState(false);
  
  // WhatsApp Chat State
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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
            body: JSON.stringify({ prompt: postContent })
        });
        const data = await res.json();
        if (data.draft) setPostContent(data.draft);
        toast.success("AI draft ready!");
    } catch (err) {
        console.error('AI Draft failed', err);
        toast.error("AI Assistant is busy, try again!");
    } finally {
        setIsAiLoading(false);
    }
  };
  const handlePost = async () => {
    if (!postContent || !postRecipient) {
        toast.error("Please provide both recipient and message");
        return;
    }

    try {
        setIsPosting(true);
        const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            body: JSON.stringify({
                to: postRecipient,
                content: postContent,
                scheduleAt: scheduleDate || null
            })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            const results = data.results || [];
            const successCount = results.filter((r: any) => !r.error).length;
            const failCount = results.filter((r: any) => r.error).length;
            
            if (failCount === 0) {
               toast.success(scheduleDate ? "Bulk Messages Scheduled!" : `Sent successfully to ${successCount} recipients!`);
            } else {
               toast.warning(`Sent to ${successCount}, but ${failCount} failed.`);
            }
            
            setPostContent("");
            if (failCount === 0) setPostRecipient(""); 
            setScheduleDate("");
            setShowScheduler(false);
            if (activeContact) fetchMessages(activeContact);
        } else {
            toast.error(data.error || "Failed to deliver interaction");
        }
    } catch (err) {
        toast.error("Network error while sending");
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden transition-colors duration-300">
      {/* 1. Left Sidebar - Minimal Platform Switcher */}
      <aside className="w-20 md:w-64 border-r border-border bg-card/30 flex flex-col pt-6 pb-4">
        <div className="px-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20">Z</div>
            <span className="font-bold text-xl hidden md:block">Zynco</span>
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-1">
            {PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                onClick={() => setActivePlatform(platform.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative",
                  activePlatform === platform.id 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <div className={cn("transition-colors", activePlatform === platform.id ? platform.color : "group-hover:text-foreground")}>
                  {platform.icon}
                </div>
                <span className="font-medium hidden md:block">{platform.name}</span>
                {activePlatform === platform.id && (
                  <motion.div 
                    layoutId="active-pill" 
                    className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full"
                  />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className="px-3 mt-auto space-y-1">
          <Link href="/dashboard">
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-all">
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium hidden md:block">Exit to Inbox</span>
            </button>
          </Link>
          <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-all">
            <Settings className="w-5 h-5" />
            <span className="font-medium hidden md:block">Settings</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Feed - The Twitter-like Stream */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/50">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <Link href="/dashboard" className="mr-2 hidden sm:block">
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search across all interactions..." 
                className="bg-muted border-border pl-10 h-10 rounded-full focus:ring-blue-500/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 hidden sm:flex">
              <Plus className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-1 px-0 md:px-0">
          <div className={cn(
            "mx-auto border-x border-border min-h-full bg-background flex flex-1",
            activePlatform === 'whatsapp' ? "max-w-full" : "max-w-2xl"
          )}>
            
            {/* WhatsApp Sidebar - Dense & Informative */}
            {activePlatform === 'whatsapp' && (
                <div className="w-80 border-r border-border flex flex-col shrink-0 bg-muted/5">
                    <div className="p-5 border-b border-border font-bold text-sm tracking-tight flex items-center justify-between bg-card">
                       <span className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-green-500" />
                          Conversations
                       </span>
                       <Badge variant="outline" className="text-[9px] bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0">
                          {contacts.length} Active
                       </Badge>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="divide-y divide-border/30">
                            {contacts.length === 0 ? (
                                <div className="p-12 text-center space-y-3 opacity-30">
                                    <MessageSquare className="w-12 h-12 mx-auto" strokeWidth={1} />
                                    <p className="text-xs font-bold uppercase tracking-widest">No active chats</p>
                                </div>
                            ) : (
                                contacts.map((contact) => (
                                    <button 
                                        key={contact.id} 
                                        onClick={() => setActiveContact(contact.id)}
                                        className={cn(
                                            "w-full px-5 py-4 text-left hover:bg-muted/50 transition-all flex gap-3 relative group",
                                            activeContact === contact.id && "bg-background border-y-border/50 shadow-sm z-10 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-1 after:bg-green-500"
                                        )}
                                    >
                                        <Avatar className="w-11 h-11 shadow-sm shrink-0 border border-border group-hover:scale-105 transition-transform">
                                            <AvatarFallback className="bg-green-500/5 text-green-600 text-xs font-bold">
                                                {contact.name?.[0] || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <h4 className="font-bold text-[13px] truncate text-foreground/90">
                                                   {contact.name || contact.id.split('@')[0]}
                                                </h4>
                                                <span className="text-[10px] font-medium text-muted-foreground/60 whitespace-nowrap">
                                                    {contact.lastTimestamp ? new Date(contact.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                                                {contact.lastMessage || "Start a conversation..."}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>
            )}

            <div className="flex-1 flex flex-col min-w-0 bg-background">
                {/* View Tabs / Header */}
                <div className="flex border-b border-border sticky top-0 bg-background/80 backdrop-blur-md z-[5] h-14 shrink-0">
                {activePlatform === 'whatsapp' ? (
                    <div className="flex items-center gap-4 px-6 py-2 flex-1">
                        {activeContact ? (
                            <>
                                <Avatar className="w-9 h-9 border border-border shadow-sm">
                                    <AvatarFallback className="bg-green-500/10 text-green-600 text-xs font-bold">
                                        {contacts.find(c => c.id === activeContact)?.name?.[0] || 'W'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm truncate">{contacts.find(c => c.id === activeContact)?.name || activeContact.split('@')[0]}</h3>
                                    <div className="flex items-center gap-1.5 leading-none">
                                       <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                       <p className="text-[10px] text-green-600/80 font-bold uppercase tracking-widest">Active Chat</p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 text-center py-2 text-muted-foreground/40 font-bold uppercase tracking-widest text-[10px]">
                                Select a conversation to start messaging
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <button className="flex-1 py-4 font-bold text-sm hover:bg-muted transition-colors border-b-2 border-primary text-primary">Unified Feed</button>
                        <button className="flex-1 py-4 font-bold text-sm text-muted-foreground hover:bg-muted transition-colors">Important Only</button>
                        <button className="flex-1 py-4 font-bold text-sm text-muted-foreground hover:bg-muted transition-colors">Scheduled</button>
                    </>
                )}
                </div>

                {/* Conversation History Area */}
                {activePlatform === 'whatsapp' && activeContact && (
                    <ScrollArea className="flex-1 bg-muted/20">
                        <div className="p-6 space-y-6 flex flex-col-reverse">
                            {/* Reverse ordering to keep recent at the bottom near the input, or just show latest 10 */}
                            {messages.slice(-15).reverse().map((m) => (
                                <div 
                                    key={m.id} 
                                    className={cn(
                                        "flex group max-w-[85%]",
                                        m.direction === 'OUTBOUND' ? "ml-auto flex-row-reverse" : "mr-auto"
                                    )}
                                >
                                    <div className={cn(
                                        "p-3 rounded-2xl shadow-sm relative transition-all hover:scale-[1.01]",
                                        m.direction === 'OUTBOUND' 
                                            ? "bg-primary text-primary-foreground rounded-tr-none" 
                                            : "bg-background border border-border rounded-tl-none border-l-4 border-l-green-500"
                                    )}>
                                        {m.direction === 'INBOUND' && (
                                            <p className="text-[10px] uppercase tracking-wider font-extrabold text-green-500 mb-1 opacity-80">New Interaction</p>
                                        )}
                                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                                        <span className={cn(
                                            "text-[9px] mt-1 block opacity-60 font-bold",
                                            m.direction === 'OUTBOUND' ? "text-right" : "text-left"
                                        )}>
                                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {messages.length > 15 && (
                                <div className="text-center py-4 opacity-50 text-[10px] font-bold uppercase tracking-widest border-b border-border mb-4">
                                    Last few interactions
                                </div>
                            )}
                            {isLoadingMessages && messages.length === 0 && (
                                <div className="flex justify-center p-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground opacity-20" />
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}

                {/* Quick Post Box */}
                <div className="p-6 border-b border-border space-y-4">
                  <div className="flex gap-4">
                    <Avatar className="w-12 h-12 border-2 border-primary/10">
                      <AvatarFallback className="bg-muted text-foreground">ME</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2">
                        <Input 
                            placeholder="Recipient (Phone or Chat ID)" 
                            className="h-9 bg-muted/30 border-border text-sm"
                            value={postRecipient}
                            onChange={(e) => setPostRecipient(e.target.value)}
                        />
                        <Badge variant="outline" className="h-9 px-3 bg-green-500/5 text-green-600 border-green-500/20 gap-1.5 font-bold">
                            <MessageSquare className="w-3.5 h-3.5" />
                            WhatsApp
                        </Badge>
                      </div>
                      <textarea 
                        className="w-full bg-transparent border-none focus:ring-0 text-lg placeholder:text-muted-foreground/60 resize-none min-h-[100px] text-foreground leading-relaxed"
                        placeholder="What's happening across your networks?"
                        value={postContent}
                        onChange={(e) => setPostContent(e.target.value)}
                      />
                      
                      {showScheduler && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="bg-muted/30 p-3 rounded-xl border border-border flex items-center gap-3"
                        >
                            <Calendar className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold text-muted-foreground">Schedule for:</span>
                            <input 
                                type="datetime-local" 
                                className="bg-transparent text-xs font-bold outline-none text-foreground"
                                value={scheduleDate}
                                onChange={(e) => setScheduleDate(e.target.value)}
                            />
                        </motion.div>
                      )}

                      <div className="flex justify-between items-center pt-5 border-t border-border/50">
                        <div className="flex gap-1.5 text-primary">
                          <button 
                            onClick={() => setShowScheduler(!showScheduler)}
                            className={cn(
                                "p-2.5 rounded-xl transition-all flex items-center gap-2",
                                showScheduler ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-primary/10"
                            )}
                            title="Schedule Message"
                          >
                            <Clock className="w-4 h-4" />
                            {showScheduler && <span className="text-xs font-bold">Scheduled</span>}
                          </button>
                          
                          <button className="p-2.5 hover:bg-primary/10 rounded-xl transition-colors text-muted-foreground/60 hover:text-primary" title="Add Bulk Recipients">
                             <Users className="w-4 h-4" />
                          </button>

                          <button 
                            className="px-3 py-1.5 hover:bg-violet-500/10 rounded-xl transition-all flex items-center gap-2 text-violet-500 group/ai border border-transparent hover:border-violet-500/20"
                            title="AI Smart Draft"
                          >
                             <Sparkles className="w-3.5 h-3.5 group-hover/ai:animate-pulse" />
                             <span className="text-[10px] font-extrabold uppercase tracking-widest">AI Draft</span>
                          </button>
                          
                          <button 
                            onClick={() => fetchMessages(activeContact!)}
                            className="p-2.5 hover:bg-primary/10 rounded-xl transition-colors text-muted-foreground/60 hover:text-primary"
                            title="Refresh Chat"
                          >
                            <Loader2 className={cn("w-4 h-4", isLoadingMessages && "animate-spin")} />
                          </button>
                        </div>
                        <Button 
                            size="sm" 
                            onClick={() => {
                                handlePost();
                                if (activeContact) fetchMessages(activeContact);
                            }}
                            disabled={isPosting || !postContent || !postRecipient}
                            className="rounded-xl bg-primary text-primary-foreground px-10 font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-0.5 active:translate-y-0 transition-all gap-2 h-11"
                        >
                          {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                          {scheduleDate ? 'Schedule Bulk' : 'Send Interaction'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {activePlatform !== 'whatsapp' && (
                <AnimatePresence initial={false}>
                  {filteredMessages.map((msg, idx) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-2">
                           <Avatar className="w-12 h-12">
                              <AvatarFallback className="bg-muted text-xs font-bold text-foreground">{msg.user.name[0]}</AvatarFallback>
                           </Avatar>
                           <div className="w-0.5 flex-1 bg-border group-last:hidden" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-bold hover:underline truncate text-foreground">{msg.user.name}</span>
                              <span className="text-muted-foreground text-sm truncate">{msg.user.handle}</span>
                              <span className="text-muted-foreground/50">·</span>
                              <span className="text-muted-foreground text-sm whitespace-nowrap">{msg.timestamp}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] bg-muted/30 border-border text-muted-foreground">
                                 {msg.platform}
                              </Badge>
                              <button className="text-muted-foreground hover:text-primary transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          
                          <p className="mt-2 text-[15px] leading-relaxed text-foreground/90">
                            {msg.content}
                          </p>

                          <div className="flex justify-between mt-4 max-w-sm text-muted-foreground">
                            <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group/action">
                              <div className="p-2 group-hover/action:bg-blue-500/10 rounded-full">
                                <MessageCircle className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-medium">{msg.replies || "0"}</span>
                            </button>
                            <button className="flex items-center gap-2 hover:text-green-500 transition-colors group/action">
                              <div className="p-2 group-hover/action:bg-green-500/10 rounded-full">
                                <Repeat className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-medium">{msg.retweets || "0"}</span>
                            </button>
                            <button className="flex items-center gap-2 hover:text-pink-500 transition-colors group/action">
                              <div className="p-2 group-hover/action:bg-pink-500/10 rounded-full">
                                <Heart className={cn("w-4 h-4", msg.id === "1" ? "fill-pink-500 text-pink-500" : "")} />
                              </div>
                              <span className="text-xs font-medium">{msg.likes || "0"}</span>
                            </button>
                            <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group/action">
                              <div className="p-2 group-hover/action:bg-blue-500/10 rounded-full">
                                <Share className="w-4 h-4" />
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                )}
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* 3. Right Sidebar - Active Intelligence */}
      <aside className="hidden lg:flex w-80 border-l border-border flex-col pt-6 px-6 bg-card/10">
        <section className="mb-8">
          <div className="flex items-center gap-2 text-primary mb-4">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-bold text-lg">Active Intel</h2>
          </div>
          <Card className="bg-card border-border rounded-2xl overflow-hidden mb-4 shadow-sm">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">Flash Summary</h3>
              <p className="text-sm text-foreground/80 leading-relaxed italic">
                "Product deployment is failing (#engineering). 3 new billing inquiries in Gmail. Naval is trending and mentions 'authenticity'."
              </p>
              <Button variant="link" className="text-primary p-0 h-auto mt-2 text-xs font-bold">Read Detail Summary</Button>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-lg mb-4 text-foreground">Action Required</h2>
          <div className="space-y-3">
             {[
               { icon: <Clock className="w-4 h-4 text-amber-500 drop-shadow-sm" />, text: "Approve JIRA deployment", sub: "Priority: High" },
               { icon: <CheckCircle2 className="w-4 h-4 text-green-500 drop-shadow-sm" />, text: "Respond to Vikas", sub: "via WhatsApp" },
               { icon: <Users className="w-4 h-4 text-blue-500 drop-shadow-sm" />, text: "Review 4 new LinkedIn DMs", sub: "Inbound leads" }
             ].map((action, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-card border border-border shadow-sm hover:border-primary/50 transition-all cursor-pointer group">
                  <div className="mt-1">{action.icon}</div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{action.text}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{action.sub}</p>
                  </div>
                </div>
             ))}
          </div>
        </section>

        <section className="mt-auto pb-6">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-[10px] text-muted-foreground hover:underline cursor-pointer">Privacy</span>
            <span className="text-[10px] text-muted-foreground hover:underline cursor-pointer">Terms</span>
            <span className="text-[10px] text-muted-foreground hover:underline cursor-pointer">Ads info</span>
            <span className="text-[10px] text-muted-foreground hover:underline cursor-pointer">More</span>
            <span className="text-[10px] text-muted-foreground hover:underline cursor-pointer font-bold">© 2026 Zynco Corp.</span>
          </div>
        </section>
      </aside>
    </div>
  );
}
