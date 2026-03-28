"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface CustomLabel {
    id: string;
    name: string;
    color: string;
    count?: number;
}

/**
 * Hook to manage custom labels and their application to emails.
 */
export function useLabels(agentId: string) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [labels, setLabels] = useState<CustomLabel[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const applyLabelMutation = useMutation(trpc.standaloneAgents.applyLabel.mutationOptions());
    const createLabelMutation = useMutation(trpc.standaloneAgents.createLabel.mutationOptions());

    const fetchLabels = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getLabels.queryOptions({ id: agentId })
            );
            setLabels((data as any)?.labels || []);
        } catch (error) {
            console.error("Failed to fetch labels:", error);
        } finally {
            setIsLoading(false);
        }
    }, [agentId, queryClient, trpc.standaloneAgents.getLabels]);

    const applyLabel = useCallback(async (emailIds: string[], labelId: string) => {
        try {
            await applyLabelMutation.mutateAsync({
                id: agentId,
                labelId,
                emailIds,
            });

            toast.success(emailIds.length > 1 ? "Label applied to selected emails" : "Label applied");

            // Refresh labels to update counts
            fetchLabels();
            return true;
        } catch (error: any) {
            toast.error(error.message || "Failed to apply label");
            return false;
        }
    }, [agentId, fetchLabels, applyLabelMutation]);

    const createLabel = useCallback(async (name: string, color: string) => {
        try {
            const data = await createLabelMutation.mutateAsync({
                id: agentId,
                name,
                color,
            });

            toast.success(`Label "${name}" created`);
            fetchLabels();
            return data;
        } catch (error: any) {
            toast.error(error.message || "Failed to create label");
            return null;
        }
    }, [agentId, fetchLabels, createLabelMutation]);

    return {
        labels,
        isLoading,
        fetchLabels,
        applyLabel,
        createLabel,
    };
}
