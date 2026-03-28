"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { AutomationRule } from "@/lib/automation/types";

export type Rule = AutomationRule;

/**
 * Hook to manage automation rules.
 */
export function useRules(agentId: string) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [rules, setRules] = useState<Rule[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isApplyingRules, setIsApplyingRules] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);

    const applyRulesMutation = useMutation(trpc.standaloneAgents.applyRules.mutationOptions());

    const fetchRules = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getRules.queryOptions({ id: agentId })
            );
            setRules(data.rules || []);
        } catch (error) {
            console.error("Failed to fetch rules:", error);
            toast.error("Failed to load automation rules");
        } finally {
            setIsLoading(false);
        }
    }, [agentId, queryClient, trpc.standaloneAgents.getRules]);

    const applyRules = useCallback(async (options: {
        category?: string;
        emailIds?: string[];
        dryRun?: boolean
    }) => {
        if (isApplyingRules) return;
        setIsApplyingRules(true);
        setLastResult(null);

        try {
            const result = await applyRulesMutation.mutateAsync({
                id: agentId,
                filter: {
                    category: options.category,
                    emailIds: options.emailIds,
                },
                dryRun: options.dryRun ?? false,
            });

            setLastResult(result);

            if ((result as any).executed > 0) {
                toast.success(`Successfully executed ${(result as any).executed} actions`);
            } else if (!options.dryRun && (result as any).matched > 0) {
                toast.info(`Matched ${(result as any).matched} emails, but no actions were needed.`);
            } else if ((result as any).matched === 0) {
                toast.info("No emails matched the rules.");
            }

            return result;
        } catch (error) {
            console.error('[ApplyRules] Error:', error);
            toast.error("Failed to apply rules");
            return { error: 'Failed' };
        } finally {
            setIsApplyingRules(false);
        }
    }, [agentId, isApplyingRules, applyRulesMutation]);

    return {
        rules,
        isLoading,
        isApplyingRules,
        lastResult,
        fetchRules,
        applyRules,
    };
}
