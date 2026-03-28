"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TutorialStep {
    id: string; // Added ID for steps
    targetId: string;
    title: string;
    content: string;
    placement?: "top" | "bottom" | "left" | "right" | "center";
    onStepEnter?: () => void; // Added callback to trigger UI changes
}

interface TutorialOverlayProps {
    steps: TutorialStep[];
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

export function TutorialOverlay({ steps, isOpen, onClose, onComplete }: TutorialOverlayProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const requestRef = useRef<number | null>(null);

    // Trigger onStepEnter for the initial step
    useEffect(() => {
        if (isOpen && steps[currentStep]?.onStepEnter) {
            steps[currentStep].onStepEnter?.();
        }
    }, [isOpen, currentStep]); // Added currentStep to dependency array

    const updateTargetRect = useCallback(() => {
        const step = steps[currentStep];
        if (!step) return;

        let element: Element | null = null;
        if (step.targetId.startsWith('.')) {
            element = document.querySelector(step.targetId);
        } else {
            element = document.getElementById(step.targetId);
        }

        if (element) {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);
        } else if (step.placement === "center") {
            setTargetRect(null);
        } else {
            // Reset rect if element is missing to avoid stale spotlight
            setTargetRect(null);
        }
        requestRef.current = requestAnimationFrame(updateTargetRect);
    }, [currentStep, steps]);

    useEffect(() => {
        if (isOpen) {
            requestRef.current = requestAnimationFrame(updateTargetRect);
            document.body.style.overflow = "hidden";
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            document.body.style.overflow = "";
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            document.body.style.overflow = "";
        };
    }, [isOpen, updateTargetRect]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            const nextIdx = currentStep + 1;
            setCurrentStep(nextIdx);
        } else {
            onComplete?.();
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (!isOpen) return null;

    const step = steps[currentStep];

    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
            {/* Backdrop with SVG Mask for Spotlight */}
            <svg className="absolute inset-0 w-full h-full pointer-events-auto">
                <defs>
                    <mask id="tutorial-spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <motion.rect
                                initial={false}
                                animate={{
                                    x: targetRect.left - 12,
                                    y: targetRect.top - 12,
                                    width: targetRect.width + 24,
                                    height: targetRect.height + 24,
                                    rx: 16
                                }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(0, 0, 0, 0.75)"
                    mask="url(#tutorial-spotlight-mask)"
                    className="transition-all duration-500"
                />
            </svg>

            {/* Pulsing Highlight Border */}
            <AnimatePresence>
                {targetRect && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            x: targetRect.left - 14,
                            y: targetRect.top - 14,
                            width: targetRect.width + 28,
                            height: targetRect.height + 28
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="absolute border-2 border-primary/60 rounded-2xl z-[10000] pointer-events-none"
                        style={{
                            boxShadow: '0 0 0 4px rgba(var(--primary), 0.1), 0 0 30px rgba(var(--primary), 0.3)'
                        }}
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                                opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            className="absolute -inset-1 border-2 border-primary/30 rounded-[1.25rem]"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tooltip Wrapper */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, scale: 0.9, y: 20, filter: "blur(4px)" }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            filter: "blur(0px)",
                            position: targetRect ? "absolute" : "relative"
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: -20, filter: "blur(4px)" }}
                        transition={{ type: "spring", damping: 25, stiffness: 250 }}
                        style={targetRect ? {
                            left: calculateTooltipPosition(targetRect, step.placement).left,
                            top: calculateTooltipPosition(targetRect, step.placement).top,
                            transform: "none"
                        } : {}}
                        className={cn(
                            "pointer-events-auto w-[380px] bg-card/95 backdrop-blur-xl border border-primary/20 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] p-0 flex flex-col z-[10001] overflow-hidden"
                        )}
                    >
                        {/* Interactive Progress Header */}
                        <div className="relative h-1.5 w-full bg-muted/30">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                                className="absolute inset-y-0 left-0 bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                            />
                        </div>

                        <div className="p-7 space-y-5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/10">
                                        <Sparkles className="w-4.5 h-4.5 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Guided Tour</span>
                                        <span className="text-[10px] text-muted-foreground font-medium">Step {currentStep + 1} of {steps.length}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-muted/50 transition-colors active:scale-90"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                <h3 className="text-2xl font-bold text-foreground tracking-tight leading-tight">{step.title}</h3>
                                <p className="text-[15px] text-muted-foreground leading-relaxed">
                                    {step.content}
                                </p>
                            </div>

                            <div className="flex items-center justify-between mt-2 pt-6 border-t border-border/40">
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/50 border border-border/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <span className="text-[10px] font-bold text-muted-foreground tracking-wider">
                                        {currentStep + 1} / {steps.length}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handlePrev}
                                        disabled={currentStep === 0}
                                        className="h-10 px-4 text-xs font-semibold rounded-xl transition-all"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={handleNext}
                                        className="h-10 px-6 text-xs font-bold rounded-xl shadow-[0_8px_16px_-4px_rgba(var(--primary),0.3)] active:scale-95 transition-all bg-primary hover:bg-primary/90"
                                    >
                                        {currentStep === steps.length - 1 ? "Finish Tour" : (
                                            <span className="flex items-center gap-2 whitespace-nowrap">
                                                Next Step
                                                <ChevronRight className="w-4 h-4" />
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function calculateTooltipPosition(rect: DOMRect, placement: string = "bottom") {
    const spacing = 24;
    const windowPadding = 20;
    const tooltipWidth = 380;
    const tooltipHeight = 280; // Estimated height for safety

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top + rect.height / 2 - tooltipHeight / 2;

    switch (placement) {
        case "bottom":
            top = rect.bottom + spacing;
            break;
        case "top":
            top = rect.top - spacing - tooltipHeight;
            break;
        case "left":
            left = rect.left - spacing - tooltipWidth;
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            break;
        case "right":
            left = rect.right + spacing;
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            break;
    }

    // Viewport containment
    if (left < windowPadding) left = windowPadding;
    if (left + tooltipWidth > window.innerWidth - windowPadding) {
        left = window.innerWidth - tooltipWidth - windowPadding;
    }

    if (top < windowPadding) top = windowPadding;
    if (top + tooltipHeight > window.innerHeight - windowPadding) {
        top = window.innerHeight - tooltipHeight - windowPadding;
    }

    // If perfectly aligned with a sidebar or edge, ensure it doesn't overlap the target
    if (placement === "right" && left < rect.right + spacing / 2) {
        left = rect.right + spacing;
    }
    if (placement === "left" && left + tooltipWidth > rect.left - spacing / 2) {
        left = rect.left - spacing - tooltipWidth;
    }

    return { left, top };
}
