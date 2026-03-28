"use client";

import { Shield, Lock, Eye, ShieldCheck, Database, Key, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function SecurityTermsView() {
    return (
        <div className="flex-1 overflow-auto bg-background p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-12 pb-20">
                {/* Hero Header */}
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified Security
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Security & Data Privacy</h1>
                    <p className="text-xl text-muted-foreground leading-relaxed">
                        Your trust is our foundation. Here's a transparent look at how we protect your information and manage your Gmail integration.
                    </p>
                </div>

                {/* Core Pillars */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Lock className="w-6 h-6 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Military-Grade Encryption</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Every byte of data moving between your browser, our servers, and Google's API is protected by TLS 1.3 encryption. Your access tokens are stored in encrypted form using AES-256 at rest.
                        </p>
                    </div>

                    <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Eye className="w-6 h-6 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Privacy by Design</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            We operate on the principle of least privilege. We only request the Gmail scopes necessary for classification and automation. We never read or store emails outside of your specific classification rules.
                        </p>
                    </div>

                    <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Database className="w-6 h-6 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Smart Data Lifecycle</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Our "Zero-Persistent" architecture ensures that newsletters and promotional content are classified in real-time and purged from our processing buffer immediately.
                        </p>
                    </div>

                    <div className="group p-6 rounded-3xl bg-card border border-border shadow-sm hover:shadow-md transition-all">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">User Control</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            You are the owner of your data. You can disconnect your account, delete your history, and revoke all permissions with a single click at any time. No questions asked.
                        </p>
                    </div>
                </div>

                {/* Detailed Terms Section */}
                <div className="space-y-8 pt-6">
                    <div className="flex items-center gap-3">
                        <div className="h-[1px] flex-1 bg-border" />
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground px-4">Detailed Terms of Engagement</h2>
                        <div className="h-[1px] flex-1 bg-border" />
                    </div>

                    <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
                        <div className="space-y-4">
                            <h4 className="text-lg font-bold flex items-center gap-2">
                                <Key className="w-5 h-5 text-primary" />
                                1. Integration Authorization
                            </h4>
                            <p className="text-muted-foreground text-sm">
                                Spinabot uses Google OAuth 2.0 to establish a secure connection. We do not see or store your Google password. Your authorization allows us to sync email headers, snippets, and content for the purpose of AI analysis and organization.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-lg font-bold flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                2. AI Processing Transparency
                            </h4>
                            <p className="text-muted-foreground text-sm">
                                Our AI models are private and siloed. Your email data is never used to train global LLM models. Processing happens in isolated environments where transient data is handled according to strict SOC2-compliant standards.
                            </p>
                        </div>

                        <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 flex gap-4">
                            <Info className="w-6 h-6 text-primary shrink-0" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-bold">Automatic Revocation Policy</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    If your account remains inactive for more than 90 days, we automatically purge your refresh tokens and classification history to ensure your data doesn't sit idle in our systems.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Status */}
                <div className="pt-10 border-t border-border flex flex-col items-center text-center gap-4">
                    <div className="flex items-center gap-2 text-emerald-500 font-bold bg-emerald-500/5 px-4 py-2 rounded-full border border-emerald-500/10">
                        <CheckCircle2 className="w-5 h-5" />
                        Active Security Guard Protected
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Last Security Audit: February 2026 • Version 2.4.0
                    </p>
                </div>
            </div>
        </div>
    );
}
