/**
 * Quiz Step - Theme Aware UI
 * Adapts to both Light and Dark modes using semantic tokens
 */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QuizStepProps {
    onComplete: (answers: QuizAnswers) => void;
    onBack?: () => void;
}

export interface QuizAnswers {
    organizationType: string;
    emailVolume: string;
    primaryRole: string;
    responseTime: string;
    primaryPriority: string;
}

const questions = [
    {
        id: "organizationType",
        question: "What type of organization do you work in?",
        subtext: "This helps us understand your work environment",
        options: [
            { value: "startup", label: "Startup", description: "Fast-paced, wearing many hats" },
            { value: "small_business", label: "Small Business", description: "10-50 employees, close-knit team" },
            { value: "mid_size", label: "Mid-size Company", description: "50-500 employees, structured teams" },
            { value: "enterprise", label: "Enterprise", description: "500+ employees, formal processes" },
            { value: "freelancer", label: "Freelancer / Consultant", description: "Independent, client-focused" },
        ],
    },
    {
        id: "emailVolume",
        question: "How many emails do you typically receive per day?",
        subtext: "We'll optimize classification based on your volume",
        options: [
            { value: "light", label: "Light", description: "< 20 emails" },
            { value: "moderate", label: "Moderate", description: "20-50 emails" },
            { value: "heavy", label: "Heavy", description: "50-100 emails" },
            { value: "very_heavy", label: "Very Heavy", description: "100-200 emails" },
            { value: "overwhelming", label: "Overwhelming", description: "200+ emails" },
        ],
    },
    {
        id: "primaryRole",
        question: "What best describes your primary role?",
        subtext: "This affects how we prioritize different email types",
        options: [
            { value: "technical", label: "Technical", description: "Engineering, Development, IT" },
            { value: "creative", label: "Creative", description: "Design, Marketing, Content" },
            { value: "management", label: "Management", description: "Team Lead, Manager, Director" },
            { value: "executive", label: "Executive", description: "C-Suite, VP, Founder" },
            { value: "operations", label: "Operations", description: "HR, Finance, Admin" },
        ],
    },
    {
        id: "responseTime",
        question: "How quickly do you need to respond to emails?",
        subtext: "We'll adjust urgency thresholds accordingly",
        options: [
            { value: "immediately", label: "Immediately", description: "Within 1 hour" },
            { value: "same_day", label: "Same Day", description: "Within 8 hours" },
            { value: "next_day", label: "Next Day", description: "Within 24 hours" },
            { value: "weekly", label: "Within a Week", description: "Flexible timeline" },
            { value: "varies", label: "It Varies", description: "Depends on topic" },
        ],
    },
    {
        id: "primaryPriority",
        question: "What's your primary email priority?",
        subtext: "We'll prioritize these types of emails",
        options: [
            { value: "action", label: "Action", description: "Tasks & to-dos" },
            { value: "moderate", label: "Moderate", description: "Balanced workflow" },
            { value: "strategic", label: "Strategic", description: "Planning & decisions" },
        ],
    },
];

export function QuizStep({ onComplete, onBack }: QuizStepProps) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});

    // Derived state for the current selection
    const currentQuestionId = questions[currentQuestion].id;
    const currentSelection = answers[currentQuestionId as keyof QuizAnswers];

    const handleAnswer = (value: string) => {
        setAnswers((prev) => ({ ...prev, [currentQuestionId]: value }));
    };

    const handleNext = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion((prev) => prev + 1);
        } else {
            onComplete(answers as QuizAnswers);
        }
    };

    const handleBack = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion((prev) => prev - 1);
        }
    };

    const handleSkip = () => {
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion((prev) => prev + 1);
        } else {
            onComplete(answers as QuizAnswers);
        }
    };

    const progressPercentage = ((currentQuestion + 1) / questions.length) * 100;

    return (
        <div className="w-full max-w-6xl mx-auto relative">
            {/* Back to Dashboard Button */}
            {onBack && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="absolute top-0 right-0 text-muted-foreground hover:text-foreground pr-0 hover:bg-transparent"
                >
                    Back to Dashboard
                    <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                </Button>
            )}

            <div className="flex flex-col items-center w-full max-w-lg mx-auto py-2 relative">

                {/* Top Text */}
                <div className="text-center mb-4 space-y-0.5">
                    <h1 className="text-lg font-semibold text-foreground">Personalize Your Experience</h1>
                    <p className="text-xs text-muted-foreground">Quick questions to make SPINaBOT work better for you</p>
                </div>

                {/* Progress Header */}
                <div className="w-full flex items-center justify-between text-[10px] text-muted-foreground font-medium mb-1 px-1">
                    <span>{currentQuestion + 1} / {questions.length}</span>
                    <button onClick={handleSkip} className="hover:text-foreground transition-colors">Skip</button>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-muted rounded-full mb-4 overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>

                {/* Main Card */}
                <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-sm">

                    <div className="mb-5 text-center sm:text-left">
                        <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mb-1 block">
                            PERSONALIZATION
                        </span>
                        <h2 className="text-xl font-bold text-card-foreground mb-1">
                            {questions[currentQuestion].question}
                        </h2>
                        {(questions[currentQuestion] as any).subtext && (
                            <p className="text-muted-foreground text-xs">
                                {(questions[currentQuestion] as any).subtext}
                            </p>
                        )}
                    </div>

                    {/* Options */}
                    <div className="space-y-2">
                        {questions[currentQuestion].options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleAnswer(option.value)}
                                className={`w-full p-3 rounded-lg border text-left transition-all duration-200 group flex items-center justify-between ${currentSelection === option.value
                                    ? "bg-secondary border-primary/50"
                                    : "bg-background border-border hover:bg-secondary hover:border-border"
                                    }`}
                            >
                                <div>
                                    <div className="text-sm font-medium text-foreground mb-0">
                                        {option.label}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground group-hover:text-foreground/80 transition-colors">
                                        {option.description}
                                    </div>
                                </div>

                                {/* Radio Circle */}
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${currentSelection === option.value
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground/30 group-hover:border-foreground/50"
                                    }`}>
                                    {currentSelection === option.value && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="w-full flex items-center justify-between mt-6 px-2">
                    <button
                        onClick={handleBack}
                        disabled={currentQuestion === 0}
                        className={`flex items-center text-xs font-medium transition-colors ${currentQuestion === 0 ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <ChevronLeft className="w-3 h-3 mr-1" />
                        Back
                    </button>

                    {/* Dot Indicators */}
                    <div className="flex gap-1.5">
                        {questions.map((_, idx) => (
                            <div
                                key={idx}
                                className={`w-1 h-1 rounded-full transition-colors ${idx === currentQuestion ? "bg-primary" : "bg-muted"
                                    }`}
                            />
                        ))}
                    </div>

                    <Button
                        onClick={handleNext}
                        disabled={!currentSelection}
                        className="px-4 h-8 text-xs"
                        size="sm"
                    >
                        {currentQuestion === questions.length - 1 ? 'Finish' : 'Next'}
                        <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                </div>

                <p className="text-[9px] text-muted-foreground mt-4 text-center">
                    Your preferences are stored securely.
                </p>
            </div>
        </div>
    );
}
