"use client";

import { useState, useEffect, useCallback } from "react";

export interface TutorialStep {
    id: string;
    title: string;
    content: string;
    targetId?: string;
    placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
    onStepEnter?: () => void;
}

/**
 * Hook to manage the onboarding tutorial state.
 */
export function useTutorial(agentId: string, hasCompletedInDb?: boolean, onCompletePersistent?: () => void) {
    const [isOpen, setIsOpen] = useState(false);
    const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

    useEffect(() => {
        // If DB says we completed it, don't auto-open
        if (hasCompletedInDb) {
            setHasSeenTutorial(true);
            return;
        }

        const seen = localStorage.getItem(`tutorial_seen_${agentId}`);
        if (!seen) {
            setHasSeenTutorial(false);
            // Auto open for new users after a short delay
            const timer = setTimeout(() => {
                setIsOpen(true);
                // Mark as seen locally even if they close it, so it doesn't auto-pop every time
                localStorage.setItem(`tutorial_seen_${agentId}`, 'true');
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [agentId, hasCompletedInDb]);

    const completeTutorial = useCallback(() => {
        localStorage.setItem(`tutorial_seen_${agentId}`, 'true');
        setHasSeenTutorial(true);
        setIsOpen(false);
        if (onCompletePersistent) {
            onCompletePersistent();
        }
    }, [agentId, onCompletePersistent]);

    const startTutorial = useCallback(() => {
        setIsOpen(true);
    }, []);

    return {
        isOpen,
        setIsOpen,
        hasSeenTutorial,
        startTutorial,
        completeTutorial,
    };
}
