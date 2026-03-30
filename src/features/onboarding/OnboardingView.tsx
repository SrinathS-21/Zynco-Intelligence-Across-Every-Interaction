"use client";

import { motion } from "framer-motion";
import { 
  Instagram, 
  Linkedin, 
  Twitter, 
  Mail, 
  Slack, 
  MessageSquare, 
  Layout, 
  CheckCircle2, 
  Plus,
  ArrowRight,
  Github,
  Search,
  Zap,
  ShieldCheck,
  Smartphone,
  ChevronLeft,
  RefreshCcw
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Connect your emails and newsletters",
    icon: <Mail className="w-6 h-6" />,
    color: "from-red-500 to-rose-600",
    shadow: "shadow-red-500/20",
    type: "Communication",
    status: "connected",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Manage chats and business messages",
    icon: <MessageSquare className="w-6 h-6" />,
    color: "from-green-500 to-emerald-600",
    shadow: "shadow-green-500/20",
    type: "Messaging",
    status: "available",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Direct messages and story replies",
    icon: <Instagram className="w-6 h-6" />,
    color: "from-purple-500 via-pink-500 to-orange-500",
    shadow: "shadow-purple-500/20",
    type: "Social",
    status: "available",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Professional networking and DMs",
    icon: <Linkedin className="w-6 h-6" />,
    color: "from-blue-600 to-blue-800",
    shadow: "shadow-blue-600/20",
    type: "Social",
    status: "available",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Workplace channels and threads",
    icon: <Slack className="w-6 h-6" />,
    color: "from-indigo-500 to-purple-600",
    shadow: "shadow-indigo-500/20",
    type: "Work",
    status: "available",
  },
  {
    id: "jira",
    name: "JIRA",
    description: "Track tasks and project comments",
    icon: <Layout className="w-6 h-6" />,
    color: "from-blue-400 to-blue-600",
    shadow: "shadow-blue-400/20",
    type: "Work",
    status: "available",
  },
  {
    id: "twitter",
    name: "Twitter (X)",
    description: "Monitor mentions and DMs",
    icon: <Twitter className="w-6 h-6" />,
    color: "from-neutral-800 to-neutral-950",
    shadow: "shadow-neutral-800/20",
    type: "Social",
    status: "available",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Issue comments and PR reviews",
    icon: <Github className="w-6 h-6" />,
    color: "from-slate-700 to-slate-900",
    shadow: "shadow-slate-700/20",
    type: "Dev",
    status: "available",
  },
] as const;

export default function OnboardingView() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>(["gmail"]);
  const [waStatus, setWaStatus] = useState<'DISCONNECTED' | 'INITIALIZING' | 'QR' | 'AUTHENTICATING' | 'READY'>('DISCONNECTED');
  const [waQr, setWaQr] = useState<string | null>(null);
  const [waDialogOpen, setWaDialogOpen] = useState(false);

  const pollWhatsAppStatus = useCallback(async () => {
    try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        setWaStatus(data.status);
        setWaQr(data.qr);
        
        if (data.status === 'READY') {
            if (!selected.includes('whatsapp')) {
                setSelected(prev => [...prev, 'whatsapp']);
                toast.success("WhatsApp Connected Successfully!");
                setWaDialogOpen(false);
            }
        }
    } catch (err) {
        console.error('Failed to poll WA status', err);
    }
  }, [selected]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (waDialogOpen || waStatus === 'INITIALIZING' || waStatus === 'QR') {
        interval = setInterval(pollWhatsAppStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [waDialogOpen, waStatus, pollWhatsAppStatus]);

  const initWhatsApp = async () => {
    try {
        setWaStatus('INITIALIZING');
        await fetch('/api/whatsapp/status', { method: 'POST' });
        setWaDialogOpen(true);
    } catch (err) {
        toast.error("Failed to initialize WhatsApp");
    }
  };

  const filtered = PLATFORMS.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  const togglePlatform = (id: string) => {
    if (id === 'whatsapp' && !selected.includes('whatsapp')) {
        initWhatsApp();
        return;
    }
    setSelected(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleResetConnection = async () => {
    try {
      setWaStatus('DISCONNECTED');
      await fetch('/api/whatsapp/reset', { method: 'POST' });
      // The status polling will eventually pick it up
    } catch (err) {
      console.error('Reset failed', err);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden relative transition-colors duration-300">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-50 dark:opacity-100">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      <main className="relative z-10 container mx-auto px-6 py-12 max-w-6xl">
        {/* Top Navigation */}
        <div className="flex justify-between items-center mb-12">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20">Z</div>
            <span className="font-bold text-xl">Zynco</span>
          </div>
        </div>

        {/* Header Section */}
        <div className="text-center mb-16 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none px-4 py-1 mb-4">
              Intelligence Across Every Interaction
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
              Unified Hub <span className="text-blue-500">Zynco</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mt-6 font-medium">
              Connect your favorite platforms and see every message, notification, 
              and thread in one beautiful, cross-pollinated dashboard.
            </p>
          </motion.div>

          <motion.div 
            className="max-w-md mx-auto relative group mt-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-500 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <Input 
              className="bg-card/50 backdrop-blur-md border-border focus:border-blue-500/50 focus:ring-blue-500/20 pl-10 h-12 text-lg rounded-2xl shadow-sm"
              placeholder="Search platforms, networks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </motion.div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-3xl bg-card border border-border backdrop-blur-md shadow-sm flex items-start gap-4 transition-all"
          >
            <Zap className="text-amber-500 w-8 h-8 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Real-time Sync</h3>
              <p className="text-muted-foreground text-sm mt-1">Updates across all screens within milliseconds.</p>
            </div>
          </motion.div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-3xl bg-card border border-border backdrop-blur-md shadow-sm flex items-start gap-4 transition-all"
          >
            <ShieldCheck className="text-green-500 w-8 h-8 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">End-to-End Encryption</h3>
              <p className="text-muted-foreground text-sm mt-1">Your data is yours. We never see your messages.</p>
            </div>
          </motion.div>
          <motion.div 
            whileHover={{ y: -5 }}
            className="p-6 rounded-3xl bg-card border border-border backdrop-blur-md shadow-sm flex items-start gap-4 transition-all"
          >
            <Smartphone className="text-blue-500 w-8 h-8 shrink-0" />
            <div>
              <h3 className="font-semibold text-lg text-foreground">Multi-Device</h3>
              <p className="text-muted-foreground text-sm mt-1">Seamless transition between desktop and mobile.</p>
            </div>
          </motion.div>
        </div>

        {/* Platforms Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filtered.map((platform, idx) => (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 + 0.5, duration: 0.5 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative cursor-pointer group`}
              onClick={() => togglePlatform(platform.id)}
            >
              <Card className={`h-full bg-card border-border overflow-hidden transition-all duration-300 shadow-sm ${selected.includes(platform.id) ? 'ring-2 ring-blue-500 border-blue-500 shadow-blue-500/10' : 'hover:border-blue-500/50 hover:shadow-md'}`}>
                {/* Platform Gradient Background */}
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${platform.color} opacity-[0.05] group-hover:opacity-[0.15] transition-opacity blur-2xl rotate-45 pointer-events-none translate-x-12 translate-y-[-12px]`} />
                
                <CardHeader className="pb-3 relative z-10">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${platform.color} p-2.5 mb-4 shadow-lg ${platform.shadow} group-hover:scale-110 transition-transform flex items-center justify-center text-white`}>
                    {platform.icon}
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                        {platform.name}
                        {selected.includes(platform.id) && (
                          <CheckCircle2 className="w-4 h-4 text-blue-500" />
                        )}
                      </CardTitle>
                      <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground border-border">
                        {platform.type}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {platform.description}
                  </p>
                </CardContent>
                <CardFooter className="pt-0 relative z-10">
                  <div className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${selected.includes(platform.id) ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'bg-muted text-muted-foreground group-hover:bg-muted/80'}`}>
                    {selected.includes(platform.id) ? 'Connected' : 'Click to Connect'}
                    <Plus className={`w-3.5 h-3.5 transition-transform ${selected.includes(platform.id) ? 'rotate-45' : ''}`} />
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Footer Actions */}
        <motion.div 
          className="mt-24 flex flex-col items-center space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
        >
          <p className="text-muted-foreground text-center max-w-lg font-medium">
            Missing a platform? We're adding new integrations every week. 
            Connect your primary ones to get started with the unified view.
          </p>
          
          <div className="flex gap-4">
            <Link href="/dashboard/unified">
              <Button 
                size="lg"
                className="px-10 h-14 bg-foreground text-background font-bold rounded-2xl hover:opacity-90 transition-all flex items-center gap-3 shadow-xl dark:shadow-white/5"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button 
                variant="outline"
                size="lg"
                className="px-10 h-14 bg-card text-foreground font-bold rounded-2xl border-border hover:bg-muted transition-all"
              >
                Skip for later
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>


      {/* WhatsApp Connection Dialog */}
      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-500" />
              Connect WhatsApp
            </DialogTitle>
            <DialogDescription>
              Scan the QR code with your phone to sync your messages.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 space-y-6">
            {waStatus === 'QR' && waQr ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-4 rounded-3xl shadow-2xl"
              >
                <img src={waQr} alt="WhatsApp QR Code" className="w-64 h-64" />
              </motion.div>
            ) : (
                <div className="flex flex-col items-center gap-4 py-12">
                   <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                   <p className="text-muted-foreground font-medium">Initializing secure connection...</p>
                </div>
            )}
            
               <div className="flex flex-col items-center gap-4">
                  <p className="text-sm font-semibold flex items-center justify-center gap-2">
                    Status: 
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest",
                      waStatus === 'READY' ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500 animate-pulse"
                    )}>
                      {waStatus}
                    </span>
                  </p>
                  
                  {(waStatus === 'QR' || waStatus === 'INITIALIZING') && (
                    <div className="flex flex-col items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleResetConnection}
                            className="text-[10px] font-bold uppercase tracking-widest h-8 gap-2 text-red-500/60 hover:text-red-500 hover:bg-red-500/5"
                        >
                            <RefreshCcw className="w-3 h-3" />
                            Reset Connection
                        </Button>
                        <p className="text-[10px] text-muted-foreground/60 italic max-w-[200px]">
                            Stuck? Force a fresh session.
                        </p>
                    </div>
                  )}
               </div>
               <p className="text-xs text-muted-foreground max-w-[240px]">
                 Open WhatsApp on your phone &gt; Settings &gt; Linked Devices &gt; Link a Device
               </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Glassy Overlay for Floating Effect */}
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />
    </div>
  );
}
