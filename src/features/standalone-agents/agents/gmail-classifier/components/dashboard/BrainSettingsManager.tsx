"use client";

import { useState, useEffect } from "react";
import {
    Sparkles,
    Loader2,
    Save,
    Info,
    BrainCircuit,
    VolumeX,
    UserRound,
    Zap,
    MessageSquareText,
    ShieldAlert,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface BrainSettingsManagerProps {
    agentId: string;
    onPersonalized?: () => void;
}

type BrainModule = 'focus' | 'silence' | 'persona' | 'automation';

export function BrainSettingsManager({ agentId, onPersonalized }: BrainSettingsManagerProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [brainData, setBrainData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<BrainModule>('focus');

    // Form States
    const [focusText, setFocusText] = useState("");
    const [silenceText, setSilenceText] = useState("");
    const [personaText, setPersonaText] = useState("");
    const [magicRuleText, setMagicRuleText] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [suggestedRules, setSuggestedRules] = useState<any[]>([]);
    const [isGeneratingRules, setIsGeneratingRules] = useState(false);

    const updateBrainMutation = useMutation(trpc.standaloneAgents.updateBrainSettings.mutationOptions());
    const createRuleMutation = useMutation(trpc.standaloneAgents.createRule.mutationOptions());

    useEffect(() => {
        fetchBrainData();
    }, [agentId]);

    const fetchBrainData = async () => {
        setIsLoading(true);
        try {
            const brain = await queryClient.fetchQuery(
                trpc.standaloneAgents.getBrainSettings.queryOptions({ id: agentId })
            );
            if (brain) {
                setBrainData(brain);
                setFocusText(brain.focus?.raw || "");
                setSilenceText(brain.silence?.raw || "");
                setPersonaText(brain.persona?.raw || "");
            }
        } catch (error) {
            console.error("Failed to load brain settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (type: BrainModule, content: string) => {
        if (!agentId) return;
        setIsSaving(true);
        try {
            const data = await updateBrainMutation.mutateAsync({
                id: agentId,
                type,
                content,
            });

            if (data.success) {
                toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} brain updated!`);
                setBrainData(data.brain);
                onPersonalized?.();
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to save brain settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleMagicGenerate = async () => {
        if (!magicRuleText.trim()) return;
        setIsGeneratingRules(true);
        try {
            const data = await updateBrainMutation.mutateAsync({
                id: agentId,
                type: 'automation_magic',
                content: magicRuleText,
            });
            if (data.success) {
                setSuggestedRules(data.suggestedRules || []);
                toast.success("AI generated automation suggestions!");
            }
        } catch (error) {
            toast.error("Failed to generate rule suggestions");
        } finally {
            setIsGeneratingRules(false);
        }
    };

    const addSuggestedRule = async (rule: any) => {
        try {
            await createRuleMutation.mutateAsync({
                id: agentId,
                rule: { ...rule, enabled: true },
            });
            toast.success("Rule added to your automation library!");
            setSuggestedRules(prev => prev.filter(r => r !== rule));
        } catch (err: any) {
            toast.error(err.message || "Failed to add rule");
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-2 opacity-50" />
                <p className="text-sm">Powering up the Brain...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <BrainCircuit className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Cognitive Preferences</h3>
                        <p className="text-xs text-muted-foreground">Train Spinabot's intelligence with natural language.</p>
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    {
                        id: 'focus' as BrainModule,
                        label: 'Priorities',
                        icon: BrainCircuit,
                        color: 'primary',
                        gradient: 'from-blue-500/20 to-indigo-500/20',
                        activeColor: 'text-blue-600 dark:text-blue-400',
                        borderColor: 'border-blue-500/30'
                    },
                    {
                        id: 'silence' as BrainModule,
                        label: 'Inbox Vibes',
                        icon: VolumeX,
                        color: 'orange',
                        gradient: 'from-orange-500/20 to-amber-500/20',
                        activeColor: 'text-orange-600 dark:text-orange-400',
                        borderColor: 'border-orange-500/30'
                    },
                    {
                        id: 'persona' as BrainModule,
                        label: 'My Voice',
                        icon: UserRound,
                        color: 'emerald',
                        gradient: 'from-emerald-500/20 to-teal-500/20',
                        activeColor: 'text-emerald-600 dark:text-emerald-400',
                        borderColor: 'border-emerald-500/30'
                    },
                    {
                        id: 'automation' as BrainModule,
                        label: 'Magic Cmds',
                        icon: Zap,
                        color: 'amber',
                        gradient: 'from-amber-500/20 to-yellow-500/20',
                        activeColor: 'text-amber-600 dark:text-amber-400',
                        borderColor: 'border-amber-500/30'
                    },
                ].map((mod) => (
                    <button
                        key={mod.id}
                        onClick={() => setActiveTab(mod.id)}
                        className={cn(
                            "group relative flex flex-col items-start gap-4 p-4 rounded-2xl border transition-all duration-300 overflow-hidden",
                            activeTab === mod.id
                                ? cn("bg-gradient-to-br shadow-md ring-1 ring-inset", mod.gradient, mod.borderColor, "ring-white/20")
                                : "bg-card border-border hover:border-primary/30 hover:bg-muted/30 hover:-translate-y-0.5"
                        )}
                    >
                        {/* Soft Glow Background for Active */}
                        {activeTab === mod.id && (
                            <div className="absolute -right-4 -top-4 w-16 h-16 bg-current opacity-10 blur-2xl rounded-full" />
                        )}

                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            activeTab === mod.id
                                ? "bg-background/80 shadow-sm"
                                : "bg-muted group-hover:bg-primary/10"
                        )}>
                            <mod.icon className={cn(
                                "w-5 h-5 transition-transform group-hover:scale-110 duration-300",
                                activeTab === mod.id ? mod.activeColor : "text-muted-foreground group-hover:text-primary"
                            )} />
                        </div>

                        <div className="space-y-0.5">
                            <span className={cn(
                                "text-sm font-bold block transition-colors",
                                activeTab === mod.id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                            )}>
                                {mod.label}
                            </span>
                            <div className={cn(
                                "h-0.5 w-4 rounded-full transition-all duration-300",
                                activeTab === mod.id ? "bg-current opacity-100 w-8" : "bg-transparent opacity-0"
                            )} />
                        </div>
                    </button>
                ))}
            </div>

            {/* Active Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'focus' && (
                    <BrainCard
                        title="What matters most?"
                        description="Describe the projects, clients, and topics that need your immediate attention. AI extracts keywords to highlight these in your Focus view."
                        value={focusText}
                        onChange={setFocusText}
                        onSave={() => handleSave('focus', focusText)}
                        isSaving={isSaving}
                        placeholder="e.g. 'I am working on Project X. Emails from @acme.com or mentioning 'legal review' are high priority...'"
                        tip="Pro Tip: Use specific names and domains for better accuracy."
                        lastUpdated={brainData?.focus?.updatedAt}
                    />
                )}

                {activeTab === 'silence' && (
                    <BrainCard
                        title="Intelligent Filter (Inbox Vibes)"
                        description="Tell the system what to automatically mute. Silence noise like newsletters, specific keywords, or suspicious links."
                        value={silenceText}
                        onChange={setSilenceText}
                        onSave={() => handleSave('silence', silenceText)}
                        isSaving={isSaving}
                        icon={<VolumeX className="w-4 h-4 text-orange-500" />}
                        placeholder="e.g. 'Hide any emails with links or those mentioning 'sales' or 'limited offer'. Also suppress suspicious security alerts...'"
                        tip="Safety First: Silenced emails aren't deleted, just moved to 'Promotions' or 'Updates'."
                        lastUpdated={brainData?.silence?.updatedAt}
                    />
                )}

                {activeTab === 'persona' && (
                    <BrainCard
                        title="Drafting Persona (My Voice)"
                        description="Define how the AI should write on your behalf. Describe your tone, signature style, and typical response length."
                        value={personaText}
                        onChange={setPersonaText}
                        onSave={() => handleSave('persona', personaText)}
                        isSaving={isSaving}
                        icon={<UserRound className="w-4 h-4 text-emerald-500" />}
                        placeholder="e.g. 'Keep my replies short and polite. I prefer an informal but professional tone. Start with 'Hi' and end with 'Cheers, Vimal'. Never use corporate buzzwords...'"
                        tip="Tone Matters: This affects generated drafts and smart replies."
                        lastUpdated={brainData?.persona?.updatedAt}
                    />
                )}

                {activeTab === 'automation' && (
                    <div className="space-y-4">
                        <div className="p-6 bg-card border border-border rounded-2xl shadow-sm space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-foreground flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-500" />
                                        Magic Command Constructor
                                    </h4>
                                    <p className="text-xs text-muted-foreground">Describe an automation rule you want, and the AI will build the logic for you.</p>
                                </div>
                            </div>

                            <div className="relative">
                                <Textarea
                                    className="min-h-[100px] bg-muted/20 border-border focus:ring-primary/20 rounded-xl p-4 text-sm resize-none"
                                    placeholder="e.g. 'If I get an email from my boss containing 'Urgent', create a Jira task and send it to Slack...'"
                                    value={magicRuleText}
                                    onChange={(e) => setMagicRuleText(e.target.value)}
                                />
                                <Button
                                    className="absolute bottom-3 right-3 h-8 gap-2 shadow-lg"
                                    size="sm"
                                    onClick={handleMagicGenerate}
                                    disabled={isGeneratingRules || !magicRuleText.trim()}
                                >
                                    {isGeneratingRules ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    Generate Suggestions
                                </Button>
                            </div>
                        </div>

                        {suggestedRules.length > 0 && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase px-2">Suggested Rules (click to add)</p>
                                {suggestedRules.map((rule, idx) => (
                                    <div
                                        key={idx}
                                        className="group p-4 bg-muted/40 border border-border rounded-xl flex items-center justify-between hover:bg-muted/80 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{rule.name}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                If {rule.conditions?.[0]?.field} {rule.conditions?.[0]?.operator} "{rule.conditions?.[0]?.value}" → {rule.action?.type.replace(/_/g, ' ')}
                                            </p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 rounded-full"
                                            onClick={() => addSuggestedRule(rule)}
                                        >
                                            <Save className="w-4 h-4 text-primary" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function BrainCard({ title, description, value, onChange, onSave, isSaving, placeholder, tip, icon, lastUpdated }: any) {
    return (
        <div className="p-6 bg-card border border-border rounded-2xl shadow-sm space-y-4">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h4 className="font-bold text-foreground flex items-center gap-2 text-base">
                        {icon || <BrainCircuit className="w-4 h-4 text-primary" />}
                        {title}
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">{description}</p>
                </div>
                {lastUpdated && (
                    <Badge variant="outline" className="text-[9px] font-medium opacity-60">
                        Updated {new Date(lastUpdated).toLocaleDateString()}
                    </Badge>
                )}
            </div>

            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl blur opacity-20 group-hover:opacity-100 transition duration-1000"></div>
                <div className="relative">
                    <Textarea
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="min-h-[140px] bg-muted/20 border-border focus:ring-primary/20 rounded-xl p-4 text-sm leading-relaxed resize-none transition-all focus:bg-background"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2">
                        <Button
                            className="h-8 gap-2 shadow-lg rounded-lg font-bold bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-all hover:scale-105 active:scale-95"
                            size="sm"
                            onClick={onSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                            )}
                            Update Intelligence
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] text-muted-foreground">{tip}</span>
            </div>
        </div>
    );
}
