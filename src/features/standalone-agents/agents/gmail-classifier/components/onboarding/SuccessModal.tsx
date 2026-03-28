/**
 * Success Modal - Step 2
 * Centered layout with Lucide icons
 */

"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, SparklesIcon, RefreshCwIcon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuccessModalProps {
    userEmail: string;
    provider: string;
    onContinue: () => void;
}

export function SuccessModal({ userEmail, provider, onContinue }: SuccessModalProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [checkmarkVisible, setCheckmarkVisible] = useState(false);

    // Entry animations
    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);
        setTimeout(() => setCheckmarkVisible(true), 400);
    }, []);

    // Get user initials for avatar
    const getInitials = (email: string) => {
        const name = email.split('@')[0];
        return name.substring(0, 2).toUpperCase();
    };

    const features = [
        { icon: SparklesIcon, text: "AI-powered classification" },
        { icon: RefreshCwIcon, text: "Real-time synchronization" },
        { icon: LockIcon, text: "End-to-end encryption" },
    ];

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div
                className={`max-w-md w-full transition-all duration-700 ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    }`}
            >
                {/* Modal Card */}
                <div className="p-8 rounded-2xl bg-card border border-border">
                    {/* Success Icon with Animation */}
                    <div className="flex justify-center mb-6">
                        <div
                            className={`w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center transition-all duration-500 ${checkmarkVisible ? "scale-100 rotate-0" : "scale-0 rotate-45"
                                }`}
                        >
                            <CheckCircleIcon className="w-10 h-10 text-green-500" />
                        </div>
                    </div>

                    {/* Title - Centered */}
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-foreground mb-2">
                            Successfully Connected!
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Your gmail account is now linked
                        </p>
                    </div>

                    {/* User Profile Card - Centered */}
                    <div className="mb-6">
                        <div className="p-4 rounded-xl bg-muted/50 border border-border">
                            <div className="flex items-center justify-center gap-3">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center font-semibold text-primary border border-primary/20 flex-shrink-0">
                                    {getInitials(userEmail)}
                                </div>

                                {/* User Info */}
                                <div className="flex-1 min-w-0 text-center">
                                    <p className="font-medium text-foreground text-sm mb-1">
                                        {userEmail}
                                    </p>
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-green-500">
                                        <div className="w-2 h-2 rounded-full bg-green-500" />
                                        <span>Secure OAuth Connection</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Features List - Centered */}
                    <div className="space-y-3 mb-6">
                        {features.map((feature, i) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={i}
                                    className={`flex items-center justify-start gap-3 text-sm text-muted-foreground transition-all duration-500`}
                                    style={{
                                        opacity: isVisible ? 1 : 0,
                                        transform: isVisible ? "translateX(0)" : "translateX(-20px)",
                                        transitionDelay: `${(i + 1) * 150}ms`,
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-4 h-4 text-foreground" />
                                    </div>
                                    <span className="text-left">{feature.text}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Continue Button - Full Width */}
                    <Button
                        onClick={onContinue}
                        className="w-full"
                        size="lg"
                    >
                        Continue Setup →
                    </Button>
                </div>
            </div>
        </div>
    );
}
