"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface AgentConfig {
    id: string;
    config: Record<string, any>;
    data: Record<string, any>;
}

/**
 * Hook to manage Standalone Agent configuration and data.
 * Handles fetching, patching, and loading states.
 */
export function useAgentConfig(agentId: string) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [agent, setAgent] = useState<AgentConfig | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const updateConfigMutation = useMutation(trpc.standaloneAgents.updateConfig.mutationOptions());
    const updateDataMutation = useMutation(trpc.standaloneAgents.updateData.mutationOptions());

    const fetchAgent = useCallback(async () => {
        if (!agentId) return;
        try {
            setIsLoading(true);
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.get.queryOptions({ id: agentId })
            );
            setAgent(data as any);
        } catch (error) {
            console.error("Error fetching agent:", error);
            // Don't show toast for every fail, but log it
            // toast.error("Failed to load agent configuration");
        } finally {
            setIsLoading(false);
        }
    }, [agentId, trpc.standaloneAgents.get, queryClient]);

    const updateConfig = useCallback(async (newConfig: Record<string, any>) => {
        try {
            setIsUpdating(true);
            const updatedAgent = await updateConfigMutation.mutateAsync({
                id: agentId,
                config: newConfig,
            });

            setAgent(updatedAgent as any);
            return updatedAgent;
        } catch (error) {
            console.error("Error updating agent config:", error);
            toast.error("Failed to save changes");
            throw error;
        } finally {
            setIsUpdating(false);
        }
    }, [agentId, updateConfigMutation]);

    const updateData = useCallback(async (newData: Record<string, any>) => {
        try {
            setIsUpdating(true);
            const updatedAgent = await updateDataMutation.mutateAsync({
                id: agentId,
                data: newData,
            });

            setAgent(updatedAgent as any);
            return updatedAgent;
        } catch (error) {
            console.error("Error updating agent data:", error);
            toast.error("Failed to update data");
            throw error;
        } finally {
            setIsUpdating(false);
        }
    }, [agentId, updateDataMutation]);

    useEffect(() => {
        if (agentId) {
            fetchAgent();
        }
    }, [agentId, fetchAgent]);

    return {
        agent,
        config: agent?.config || {},
        data: agent?.data || {},
        isLoading,
        isUpdating,
        refresh: fetchAgent,
        updateConfig,
        updateData,
        setAgent, // For manual local updates if needed
    };
}
