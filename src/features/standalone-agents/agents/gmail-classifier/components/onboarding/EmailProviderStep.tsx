/**
 * Email Provider Selection
 * With animations and exact layout match
 */

"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EmailProviderStepProps {
    onSelect: (provider: "gmail" | "outlook" | "zoho") => void;
    isLoading?: boolean;
}

const providers = [
    {
        id: "gmail" as const,
        name: "Gmail",
        description: "Secure OAuth connection",
        popular: true,
        logo: "/logos/gmail.svg",
    },
    {
        id: "outlook" as const,
        name: "Outlook",
        description: "Secure OAuth connection",
        popular: true,
        logo: "/logos/outlook.svg",
    },
    {
        id: "zoho" as const,
        name: "Zoho Mail",
        description: "Secure OAuth connection",
        popular: false,
        logo: "/logos/zohomail.svg",
    },
];

const securityFeatures = [
    { text: "256-bit encryption" },
    { text: "OAuth 2.0 secure login" },
    { text: "No password stored" },
];

export function EmailProviderStep({ onSelect, isLoading }: EmailProviderStepProps) {
    const [isVisible, setIsVisible] = useState(false);

    // Entry animation
    useEffect(() => {
        setTimeout(() => setIsVisible(true), 100);
    }, []);

    return (
        <div
            className={`max-w-5xl mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
        >
            {/* Header */}
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                    Connect Your Email
                </h1>
                <p className="text-muted-foreground text-lg">
                    Select your email provider to get started with Spinabot
                </p>

                {/* Security Message */}
                <div className="flex items-center justify-center gap-2 mt-6">
                    <ShieldCheckIcon className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">
                        Your data is encrypted and secure
                    </span>
                </div>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
                {providers.map((provider, index) => {
                    const isComingSoon = provider.id === 'outlook' || provider.id === 'zoho';
                    return (
                        <button
                            key={provider.id}
                            onClick={() => {
                                if (isComingSoon) {
                                    toast.info(`${provider.name} integration will be available soon!`);
                                } else {
                                    !isLoading && onSelect(provider.id);
                                }
                            }}
                            disabled={isLoading}
                            className={`group relative p-8 rounded-2xl bg-card border-2 border-border hover:border-primary/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                                }`}
                            style={{
                                transitionDelay: `${index * 100 + 200}ms`,
                            }}
                        >
                            {/* Popular Badge */}
                            {provider.popular && !isComingSoon && (
                                <div className="absolute top-4 right-4">
                                    <div className="px-3 py-1 text-xs font-medium bg-background border border-border rounded-full text-foreground flex items-center gap-1">
                                        <span>⭐</span>
                                        <span>Popular</span>
                                    </div>
                                </div>
                            )}

                            {/* Coming Soon Badge */}
                            {isComingSoon && (
                                <div className="absolute top-4 right-4">
                                    <div className="px-3 py-1 text-xs font-medium bg-muted border border-border rounded-full text-muted-foreground flex items-center gap-1">
                                        <span>🚀</span>
                                        <span>Coming Soon</span>
                                    </div>
                                </div>
                            )}

                            {/* Logo */}
                            <div className="mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center mx-auto group-hover:scale-110 transition-transform p-3">
                                    <Image
                                        src={provider.logo}
                                        alt={`${provider.name} logo`}
                                        width={48}
                                        height={48}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            </div>

                            {/* Provider Name */}
                            <h3 className="text-xl font-semibold text-foreground mb-2">
                                {provider.name}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground mb-4">
                                {provider.description}
                            </p>

                            {/* Hover Border Effect */}
                            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </button>
                    );
                })}
            </div>

            {/* Security Features */}
            <div className="flex items-center justify-center gap-8">
                {securityFeatures.map((feature, index) => (
                    <div
                        key={index}
                        className={`flex items-center gap-2 text-sm text-muted-foreground transition-all duration-500`}
                        style={{
                            opacity: isVisible ? 1 : 0,
                            transitionDelay: `${index * 100 + 500}ms`,
                        }}
                    >
                        <ShieldCheckIcon className="w-4 h-4 text-green-500" />
                        <span>{feature.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
