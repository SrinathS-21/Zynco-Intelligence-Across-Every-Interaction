"use client";

import { Shield, Lock, Eye, CheckCircle2, AlertTriangle, ShieldCheck, Database, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface SecurityTermsStepProps {
    onAccept: () => void;
    onBack: () => void;
}

export function SecurityTermsStep({ onAccept, onBack }: SecurityTermsStepProps) {
    const [scrolledToBottom, setScrolledToBottom] = useState(false);
    const [agreed, setAgreed] = useState(false);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            setScrolledToBottom(true);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="text-center space-y-2">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
                    <ShieldCheck className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Security & Data Privacy</h1>
                <p className="text-muted-foreground max-w-xl mx-auto">
                    We take your data security seriously. Please review how we handle your Gmail information before accessing your dashboard.
                </p>
            </div>

            {/* Security Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-4 rounded-xl space-y-2">
                    <div className="p-2 bg-blue-500/10 rounded-lg w-fit">
                        <Lock className="w-5 h-5 text-blue-500" />
                    </div>
                    <h3 className="font-semibold text-sm">End-to-End Encryption</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        All data transmitted between your Gmail and Spinabot is encrypted using enterprise-grade TLS 1.3.
                    </p>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl space-y-2">
                    <div className="p-2 bg-emerald-500/10 rounded-lg w-fit">
                        <Eye className="w-5 h-5 text-emerald-500" />
                    </div>
                    <h3 className="font-semibold text-sm">Minimal Data Usage</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        We only process email metadata and content for classification. We don't sell or share your personal data.
                    </p>
                </div>
                <div className="bg-card border border-border p-4 rounded-xl space-y-2">
                    <div className="p-2 bg-orange-500/10 rounded-lg w-fit">
                        <Database className="w-5 h-5 text-orange-500" />
                    </div>
                    <h3 className="font-semibold text-sm">Zero-Persistent Storage</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Irrelevant emails are processed in real-time and never stored on our permanent databases.
                    </p>
                </div>
            </div>

            {/* Terms and Conditions Content */}
            <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                <div className="bg-muted/50 px-6 py-3 border-b border-border flex justify-between items-center">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Standard Terms of Service</h2>
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">V 2.0</span>
                </div>

                <div
                    className="p-6 h-64 overflow-y-auto space-y-6 text-sm leading-relaxed text-muted-foreground scrollbar-thin scrollbar-thumb-border"
                    onScroll={handleScroll}
                >
                    <section className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Key className="w-4 h-4 text-primary" />
                            1. Data Access & Authorization
                        </h3>
                        <p>
                            By clicking "Allow Everything", you grant Spinabot permission to access your Gmail account via Google OAuth. This access is restricted to the scopes you approved during the connection phase. You can revoke this access at any time through your Google Account settings.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" />
                            2. Purpose of Processing
                        </h3>
                        <p>
                            Spinabot processes your email data solely for the purpose of providing intelligent classification, search, and automated organization features. We use advanced LLM technology to understand email context and apply your customized rules.
                        </p>
                    </section>

                    <section className="space-y-2">
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            3. Confidentiality & Security
                        </h3>
                        <p>
                            Your data is treated with strict confidentiality. Our AI models are designed to process information without retaining individual email contents for training purposes. We implement robust technical and organizational measures to prevent unauthorized access.
                        </p>
                    </section>

                    <section className="space-y-2 text-xs border-t border-border pt-4">
                        <p className="italic">
                            Important: Spinabot is an AI-powered assistant. While we strive for 100% accuracy, automated classifications should be reviewed for critical communications. We are not responsible for actions taken based on incorrect automated classifications.
                        </p>
                    </section>
                </div>

                <div className="px-6 py-4 border-t border-border bg-muted/30">
                    <div className="flex items-start gap-4">
                        <Checkbox
                            id="terms-agree"
                            checked={agreed}
                            onCheckedChange={(checked) => setAgreed(checked === true)}
                            className="mt-1"
                        />
                        <div className="grid gap-1.5 leading-none">
                            <label
                                htmlFor="terms-agree"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                                I have read and agree to the Security & Data Privacy Terms
                            </label>
                            <p className="text-xs text-muted-foreground">
                                You must scroll to the bottom of the terms to enable this checkbox.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <div className="p-1 bg-emerald-500/10 rounded-full text-emerald-500">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        Secure & Verified Integration
                    </div>

                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="ghost" onClick={onBack} className="flex-1 sm:flex-none">
                            Back
                        </Button>
                        <Button
                            onClick={onAccept}
                            disabled={!scrolledToBottom || !agreed}
                            className={cn(
                                "flex-1 sm:flex-none px-8 font-bold transition-all shadow-lg",
                                agreed && scrolledToBottom ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary"
                            )}
                        >
                            Allow Everything & Continue
                        </Button>
                    </div>
                </div>
            </div>

            {/* Trust Footer */}
            <div className="flex flex-wrap justify-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500 pb-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Image src="/logos/google-cloud.svg" alt="Google Cloud" width={20} height={20} className="w-5 h-5" />
                    Google Cloud Partner
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="w-5 h-5" />
                    GDPR Compliant
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="w-5 h-5" />
                    SOC2 Type II (Pending)
                </div>
            </div>
        </div>
    );
}

// Simple internal Image mock since next/image might be needed but I'll use a span/icon if not available
function Image({ src, alt, width, height, className }: any) {
    return (
        <span className={cn("flex items-center justify-center font-bold text-[10px]", className)} style={{ width, height }}>
            {alt.charAt(0)}
        </span>
    );
}

const Target = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
);
