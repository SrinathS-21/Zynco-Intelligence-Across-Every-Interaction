/**
 * Step Progress Component
 * Matches original email-classifier design with SpinaBOT theme
 */

import { MailIcon, WrenchIcon, BookIcon, SettingsIcon, LayoutDashboardIcon, CheckCircle2Icon } from "lucide-react";

interface Step {
    id: number;
    name: string;
    icon: any;
    completed: boolean;
    active: boolean;
}

interface StepProgressProps {
    currentStep: number;
}

const STEPS = [
    { id: 1, name: "Email Connected", icon: MailIcon },
    { id: 2, name: "Choose Tool", icon: WrenchIcon },
    { id: 3, name: "Knowledge Base", icon: BookIcon },
    { id: 4, name: "Personalize", icon: SettingsIcon },
    { id: 5, name: "Dashboard", icon: LayoutDashboardIcon },
];

export function StepProgress({ currentStep }: StepProgressProps) {
    return (
        <div className="flex items-center justify-center gap-4 mb-16">
            {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = currentStep > step.id;
                const isActive = currentStep === step.id;

                return (
                    <div key={step.id} className="flex items-center">
                        <div className="flex flex-col items-center gap-2">
                            {/* Icon Circle */}
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${isCompleted
                                    ? "bg-blue-600 border-blue-600"
                                    : isActive
                                        ? "bg-blue-50 border-blue-200"
                                        : "bg-white border-slate-200"
                                    }`}
                            >
                                {isCompleted ? (
                                    <CheckCircle2Icon className="w-6 h-6 text-primary-foreground" />
                                ) : (
                                    <Icon
                                        className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-slate-500"
                                            }`}
                                    />
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className={`text-xs font-medium ${isActive ? "text-slate-900" : "text-slate-500"
                                    }`}
                            >
                                {step.name}
                            </span>
                        </div>

                        {/* Connector Line */}
                        {index < STEPS.length - 1 && (
                            <div
                                className={`w-20 h-0.5 mx-2 ${isCompleted ? "bg-blue-600" : "bg-slate-200"
                                    }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
