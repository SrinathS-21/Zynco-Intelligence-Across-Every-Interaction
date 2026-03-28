"use client";

import { useMemo } from "react";

type QueryOptionsFactory<TInput, TOutput> = {
    queryOptions: (input: TInput) => {
        queryKey: unknown[];
        queryFn: () => Promise<TOutput>;
    };
};

type MutationOptionsFactory<TInput, TOutput> = {
    mutationOptions: () => {
        mutationFn: (input: TInput) => Promise<TOutput>;
    };
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
        },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
    }
    return data as T;
}

async function fetchAgent(agentId: string) {
    const data = await apiFetch<{ agent: any }>("/api/standalone-agents/gmail-classifier/init", {
        method: "POST",
        body: JSON.stringify({ agentId }),
    });
    return data.agent;
}

function toQuery(params: Record<string, unknown>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        query.set(key, String(value));
    }
    const text = query.toString();
    return text ? `?${text}` : "";
}

function getConnectEndpoint(provider: string) {
    switch (provider) {
        case "gmail":
            return "/api/standalone-agents/gmail-classifier/connect-gmail";
        case "jira":
            return "/api/standalone-agents/gmail-classifier/connect-jira";
        case "notion":
            return "/api/standalone-agents/gmail-classifier/connect-notion";
        case "slack":
            return "/api/standalone-agents/gmail-classifier/connect-slack";
        default:
            return "";
    }
}

export function useTRPC() {
    return useMemo(() => {
        const standaloneAgents = {
            list: {
                queryOptions: () => ({
                    queryKey: ["standaloneAgents.list"],
                    queryFn: () => apiFetch<any[]>("/api/standalone-agents/gmail-classifier/list"),
                }),
            } satisfies QueryOptionsFactory<void, any[]>,

            get: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.get", id],
                    queryFn: () => fetchAgent(id),
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            updateConfig: {
                mutationOptions: () => ({
                    mutationFn: async ({ id, config }: { id: string; config: Record<string, unknown> }) => {
                        await apiFetch<{ config: any }>("/api/standalone-agents/gmail-classifier/config", {
                            method: "PATCH",
                            body: JSON.stringify({ agentId: id, configPatch: config }),
                        });
                        return fetchAgent(id);
                    },
                }),
            } satisfies MutationOptionsFactory<{ id: string; config: Record<string, unknown> }, any>,

            updateData: {
                mutationOptions: () => ({
                    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
                        await apiFetch<any>("/api/standalone-agents/gmail-classifier/data", {
                            method: "PATCH",
                            body: JSON.stringify({ agentId: id, dataPatch: data }),
                        });
                        return fetchAgent(id);
                    },
                }),
            } satisfies MutationOptionsFactory<{ id: string; data: Record<string, unknown> }, any>,

            getConnectUrl: {
                queryOptions: ({ id, provider }: { id: string; provider: string }) => ({
                    queryKey: ["standaloneAgents.getConnectUrl", id, provider],
                    queryFn: async () => {
                        const endpoint = getConnectEndpoint(provider);
                        if (!endpoint) {
                            return { authUrl: "", unsupported: true } as any;
                        }
                        return apiFetch<any>(endpoint, {
                            method: "POST",
                            body: JSON.stringify({ agentId: id }),
                        });
                    },
                }),
            } satisfies QueryOptionsFactory<{ id: string; provider: string }, any>,

            getEmails: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getEmails", id],
                    queryFn: () => apiFetch<any>(`/api/standalone-agents/gmail-classifier/get-emails?agentId=${id}`),
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            getEmailIdDetails: {
                queryOptions: ({ id, emailId }: { id: string; emailId: string }) => ({
                    queryKey: ["standaloneAgents.getEmailIdDetails", id, emailId],
                    queryFn: () =>
                        apiFetch<any>(
                            `/api/standalone-agents/gmail-classifier/email-details${toQuery({ agentId: id, emailId })}`
                        ),
                }),
            } satisfies QueryOptionsFactory<{ id: string; emailId: string }, any>,

            syncEmails: {
                mutationOptions: () => ({
                    mutationFn: ({ id, ...rest }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/fetch-emails", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, ...rest }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getRules: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getRules", id],
                    queryFn: () => apiFetch<any>(`/api/standalone-agents/gmail-classifier/automation-rules${toQuery({ agentId: id })}`),
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            createRule: {
                mutationOptions: () => ({
                    mutationFn: ({ id, rule }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/automation-rules", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, rule }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            updateRule: {
                mutationOptions: () => ({
                    mutationFn: ({ id, ruleId, updates }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/automation-rules", {
                            method: "PATCH",
                            body: JSON.stringify({ agentId: id, ruleId, updates }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            deleteRule: {
                mutationOptions: () => ({
                    mutationFn: ({ id, ruleId }: any) =>
                        apiFetch<any>(`/api/standalone-agents/gmail-classifier/automation-rules?agentId=${id}&ruleId=${ruleId}`, {
                            method: "DELETE",
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            applyRules: {
                mutationOptions: () => ({
                    mutationFn: ({ id, filter, dryRun }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/automation-rules/apply", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, filter, dryRun }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getJiraProjects: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getJiraProjects", id],
                    queryFn: async () => {
                        const data = await apiFetch<any>("/api/standalone-agents/gmail-classifier/jira-projects", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id }),
                        });
                        return data.projects || [];
                    },
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            getSlackChannels: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getSlackChannels", id],
                    queryFn: async () => {
                        const configRes = await apiFetch<any>(`/api/standalone-agents/gmail-classifier/config?agentId=${id}`);
                        return (configRes.config?.slack?.channels || []) as any[];
                    },
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            getNotionDatabases: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getNotionDatabases", id],
                    queryFn: async () => {
                        const configRes = await apiFetch<any>(`/api/standalone-agents/gmail-classifier/config?agentId=${id}`);
                        return (configRes.config?.notion?.databases || []) as any[];
                    },
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            createJiraTask: {
                mutationOptions: () => ({
                    mutationFn: ({ id, email, projectKey }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/create-jira-task", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, email, projectKey }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            sendSlackMessage: {
                mutationOptions: () => ({
                    mutationFn: ({ id, email, channelId }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/send-slack-message", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, email, channelId }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getLabels: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getLabels", id],
                    queryFn: () => apiFetch<any>(`/api/standalone-agents/gmail-classifier/labels${toQuery({ agentId: id })}`),
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            createLabel: {
                mutationOptions: () => ({
                    mutationFn: ({ id, ...payload }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/labels", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, ...payload }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            updateLabel: {
                mutationOptions: () => ({
                    mutationFn: ({ id, labelId, updates }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/labels", {
                            method: "PATCH",
                            body: JSON.stringify({ agentId: id, labelId, updates }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            deleteLabel: {
                mutationOptions: () => ({
                    mutationFn: ({ id, labelId }: any) =>
                        apiFetch<any>(`/api/standalone-agents/gmail-classifier/labels${toQuery({ agentId: id, labelId })}`, {
                            method: "DELETE",
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            testLabel: {
                queryOptions: (_input: any) => ({
                    queryKey: ["standaloneAgents.testLabel", _input],
                    queryFn: () =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/labels/test", {
                            method: "POST",
                            body: JSON.stringify({
                                agentId: _input.id,
                                description: _input.description,
                                userEmail: _input.userEmail,
                            }),
                        }),
                }),
            } satisfies QueryOptionsFactory<any, any>,

            suggestLabels: {
                mutationOptions: () => ({
                    mutationFn: ({ id }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/labels/suggest", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            applyLabel: {
                mutationOptions: () => ({
                    mutationFn: ({ id, labelId, emailIds }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/labels/apply", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, labelId, emailIds }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getDailyDigest: {
                queryOptions: ({ id, forceRefresh }: { id: string; forceRefresh?: boolean }) => ({
                    queryKey: ["standaloneAgents.getDailyDigest", id, forceRefresh],
                    queryFn: () =>
                        apiFetch<any>(
                            `/api/standalone-agents/gmail-classifier/daily-digest${toQuery({ agentId: id, forceRefresh })}`
                        ),
                }),
            } satisfies QueryOptionsFactory<{ id: string; forceRefresh?: boolean }, any>,

            getSpam: {
                queryOptions: ({ id, count }: { id: string; count?: number }) => ({
                    queryKey: ["standaloneAgents.getSpam", id, count],
                    queryFn: async () => {
                        const data = await apiFetch<any>(
                            `/api/standalone-agents/gmail-classifier/fetch-spam${toQuery({ agentId: id, count })}`
                        );
                        return data.spamEmails || [];
                    },
                }),
            } satisfies QueryOptionsFactory<{ id: string; count?: number }, any>,

            rescueEmail: {
                mutationOptions: () => ({
                    mutationFn: ({ id, emailId }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/rescue-email", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, emailId }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            searchNotion: {
                mutationOptions: () => ({
                    mutationFn: ({ id, query }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/notion/search", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, query }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            createNotionPage: {
                mutationOptions: () => ({
                    mutationFn: ({ id, title, content, parentId, parentType }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/notion/create-page", {
                            method: "POST",
                            body: JSON.stringify({
                                agentId: id,
                                title,
                                content,
                                databaseId: parentId,
                                parentType,
                            }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getFocusPreferences: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getFocusPreferences", id],
                    queryFn: () =>
                        apiFetch<any>(`/api/standalone-agents/gmail-classifier/focus-preferences${toQuery({ agentId: id })}`),
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            updateFocusPreferences: {
                mutationOptions: () => ({
                    mutationFn: ({ id, preferences }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/focus-preferences", {
                            method: "PATCH",
                            body: JSON.stringify({ agentId: id, preferences }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getFocusEmails: {
                queryOptions: ({ id, forceRefresh }: { id: string; forceRefresh?: boolean }) => ({
                    queryKey: ["standaloneAgents.getFocusEmails", id, forceRefresh],
                    queryFn: () =>
                        apiFetch<any>(
                            `/api/standalone-agents/gmail-classifier/focus-emails${toQuery({ agentId: id, forceRefresh })}`
                        ),
                }),
            } satisfies QueryOptionsFactory<{ id: string; forceRefresh?: boolean }, any>,

            getBrainSettings: {
                queryOptions: ({ id }: { id: string }) => ({
                    queryKey: ["standaloneAgents.getBrainSettings", id],
                    queryFn: () => apiFetch<any>(`/api/standalone-agents/gmail-classifier/brain-settings${toQuery({ agentId: id })}`),
                }),
            } satisfies QueryOptionsFactory<{ id: string }, any>,

            updateBrainSettings: {
                mutationOptions: () => ({
                    mutationFn: ({ id, type, content }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/brain-settings", {
                            method: "PATCH",
                            body: JSON.stringify({ agentId: id, type, content }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            getActivityLogs: {
                queryOptions: ({ id, type, limit }: { id: string; type?: string; limit?: number }) => ({
                    queryKey: ["standaloneAgents.getActivityLogs", id, type, limit],
                    queryFn: async () => {
                        const query = new URLSearchParams({ agentId: id });
                        if (type) query.set("type", type);
                        if (limit) query.set("limit", String(limit));
                        const data = await apiFetch<any>(`/api/standalone-agents/gmail-classifier/activity?${query.toString()}`);
                        return data.logs || [];
                    },
                }),
            } satisfies QueryOptionsFactory<any, any>,

            generateReplyDraft: {
                mutationOptions: () => ({
                    mutationFn: ({ id, emailId, intent }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/generate-reply-draft", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, emailId, intent }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,

            sendEmail: {
                mutationOptions: () => ({
                    mutationFn: ({ id, ...payload }: any) =>
                        apiFetch<any>("/api/standalone-agents/gmail-classifier/send-email", {
                            method: "POST",
                            body: JSON.stringify({ agentId: id, ...payload }),
                        }),
                }),
            } satisfies MutationOptionsFactory<any, any>,
        };

        const credentials = {
            getByType: {
                queryOptions: ({ type }: { type: string }) => ({
                    queryKey: ["credentials.getByType", type],
                    queryFn: async () => [] as any[],
                }),
            } satisfies QueryOptionsFactory<{ type: string }, any>,
        };

        return {
            standaloneAgents,
            credentials,
        };
    }, []);
}
