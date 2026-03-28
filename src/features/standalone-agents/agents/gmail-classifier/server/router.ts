import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import prisma from "@/lib/db";
import { TRPCError } from "@trpc/server";

// Base procedure for agents that validates authentication and ownership
// We redefine it here to keep the module self-contained, or we could import it.
// For true standalone nature, re-defining or importing from a shared 'base' is fine.
const agentProcedure = protectedProcedure
    .input(z.object({ id: z.string() }))
    .use(async ({ input, ctx, next }) => {
        const agent = await prisma.standaloneAgent.findUnique({
            where: {
                id: input.id,
                userId: ctx.auth?.user.id,
            },
        });

        if (!agent) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: "Agent not found or ownership validation failed",
            });
        }

        return next({
            ctx: { ...ctx, agent },
        });
    });

export const gmailClassifierRouter = createTRPCRouter({
    // GET emails (cached)
    getEmails: agentProcedure.query(({ ctx }) => {
        const data = ctx.agent.data as any;
        const config = ctx.agent.config as any;

        return {
            emails: data?.emails || [],
            lastSync: data?.lastSync || null,
            stats: data?.stats || {},
            syncPreferences: data?.syncPreferences || null,
            isConnected: !!config?.accessToken,
            gmailEmail: config?.gmailEmail || null,
        };
    }),

    // GET email details
    getEmailIdDetails: agentProcedure
        .input(z.object({ emailId: z.string() }))
        .query(async ({ input, ctx }) => {
            const { getValidAccessToken } = await import('./services/token-service');
            const accessToken = await getValidAccessToken(ctx.agent.id);

            if (!accessToken) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Gmail not connected' });
            }

            const { getGmailMessage } = await import('@/lib/gmail/client');
            return getGmailMessage(accessToken, input.emailId);
        }),

    // GENERATE reply draft
    generateReplyDraft: agentProcedure
        .input(z.object({
            emailId: z.string(),
            intent: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { generateDraft } = await import('./services/mail-service');
            return generateDraft(ctx.agent.id, ctx.auth!.user.id, input.emailId, input.intent);
        }),

    // SEND email
    sendEmail: agentProcedure
        .input(z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string(),
            threadId: z.string().optional(),
            inReplyTo: z.string().optional(),
            references: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { sendEmail } = await import('./services/mail-service');
            return sendEmail(ctx.agent.id, ctx.auth!.user.id, input);
        }),

    // SYNC emails
    syncEmails: agentProcedure
        .input(z.object({
            count: z.number().optional(),
            query: z.string().optional(),
            dateRange: z.string().optional(),
            syncMode: z.enum(['count', 'days']).optional(),
            freshSync: z.boolean().default(false),
            excludePromotions: z.boolean().optional(),
            excludeUpdates: z.boolean().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { syncAgentEmails } = await import('./services/sync-service');
            return syncAgentEmails(ctx.agent.id, ctx.auth!.user.id, input);
        }),

    // GET rules
    getRules: agentProcedure.query(({ ctx }) => {
        const config = ctx.agent.config as any;
        return {
            rules: config?.automationRules || [],
            enabled: !!config?.automationRulesEnabled,
        };
    }),

    // APPLY rules
    applyRules: agentProcedure
        .input(z.object({
            filter: z.object({
                category: z.string().optional(),
                emailIds: z.array(z.string()).optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                priority: z.string().optional(),
            }).optional(),
            dryRun: z.boolean().default(false),
        }))
        .mutation(async ({ input, ctx }) => {
            const { applyAgentRules } = await import('./services/rules-service');
            return applyAgentRules(ctx.agent.id, ctx.auth!.user.id, input.filter || {}, input.dryRun);
        }),

    // GET Jira projects
    getJiraProjects: agentProcedure.query(async ({ ctx }) => {
        const { getJiraProjects } = await import('./services/integration-service');
        return getJiraProjects(ctx.agent.id, ctx.auth!.user.id);
    }),

    // GET Notion databases
    getNotionDatabases: agentProcedure.query(async ({ ctx }) => {
        const { getNotionDatabases } = await import('./services/integration-service');
        return getNotionDatabases(ctx.agent.id, ctx.auth!.user.id);
    }),

    // GET Slack channels
    getSlackChannels: agentProcedure.query(async ({ ctx }) => {
        const { getSlackChannels } = await import('./services/integration-service');
        return getSlackChannels(ctx.agent.id, ctx.auth!.user.id);
    }),

    // CREATE Jira task
    createJiraTask: agentProcedure
        .input(z.object({
            email: z.any(),
            projectKey: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { createJiraTask } = await import('./services/integration-service');
            return createJiraTask(ctx.agent.id, ctx.auth!.user.id, input.email, input.projectKey);
        }),

    // SEND Slack message
    sendSlackMessage: agentProcedure
        .input(z.object({
            email: z.any(),
            channelId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { sendSlackMessage } = await import('./services/integration-service');
            return sendSlackMessage(ctx.agent.id, ctx.auth!.user.id, input.email, input.channelId);
        }),

    // GET labels
    getLabels: agentProcedure.query(async ({ ctx }) => {
        const { getAgentLabels } = await import('./services/labels-service');
        return getAgentLabels(ctx.agent.id, ctx.auth!.user.id);
    }),

    // CREATE label
    createLabel: agentProcedure
        .input(z.object({
            name: z.string(),
            color: z.string(),
            userContext: z.string().optional(),
            customRules: z.array(z.any()).optional(),
            autoApply: z.boolean().optional(),
            confidenceThreshold: z.number().optional(),
            useLLMFallback: z.boolean().optional(),
            emailIds: z.array(z.string()).optional(), // For manual labeling of existing emails
        }))
        .mutation(async ({ input, ctx }) => {
            const { createAgentLabel } = await import('./services/labels-service');
            return createAgentLabel(ctx.agent.id, ctx.auth!.user.id, input);
        }),

    // UPDATE label
    updateLabel: agentProcedure
        .input(z.object({
            labelId: z.string(),
            updates: z.object({
                name: z.string().optional(),
                color: z.string().optional(),
                userContext: z.string().optional(),
                autoApply: z.boolean().optional(),
                confidenceThreshold: z.number().optional(),
                useLLMFallback: z.boolean().optional(),
            }),
        }))
        .mutation(async ({ input, ctx }) => {
            const { updateAgentLabel } = await import('./services/labels-service');
            return updateAgentLabel(ctx.agent.id, ctx.auth!.user.id, input.labelId, input.updates);
        }),

    // DELETE label
    deleteLabel: agentProcedure
        .input(z.object({
            labelId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { deleteAgentLabel } = await import('./services/labels-service');
            return deleteAgentLabel(ctx.agent.id, ctx.auth!.user.id, input.labelId);
        }),

    // TEST label
    testLabel: agentProcedure
        .input(z.object({
            description: z.string(),
            userEmail: z.string().optional(),
        }))
        .query(async ({ input, ctx }) => {
            const { testAgentLabel } = await import('./services/labels-service');
            return testAgentLabel(ctx.agent.id, ctx.auth!.user.id, input.description, input.userEmail);
        }),

    // SUGGEST labels
    suggestLabels: agentProcedure.mutation(async ({ ctx }) => {
        const { suggestAgentLabels } = await import('./services/labels-service');
        return suggestAgentLabels(ctx.agent.id, ctx.auth!.user.id);
    }),

    // APPLY label
    applyLabel: agentProcedure
        .input(z.object({
            labelId: z.string(),
            emailIds: z.array(z.string()),
        }))
        .mutation(async ({ input, ctx }) => {
            const { applyAgentLabel } = await import('./services/labels-service');
            return applyAgentLabel(ctx.agent.id, ctx.auth!.user.id, input.labelId, input.emailIds);
        }),

    // GET daily digest
    getDailyDigest: agentProcedure
        .input(z.object({
            forceRefresh: z.boolean().optional().default(false),
        }))
        .query(async ({ input, ctx }) => {
            const { getAgentDailyDigest } = await import('./services/digest-service');
            return getAgentDailyDigest(ctx.agent.id, ctx.auth!.user.id, input.forceRefresh);
        }),

    // GET spam emails
    getSpam: agentProcedure
        .input(z.object({
            count: z.number().optional().default(30),
        }))
        .query(async ({ input, ctx }) => {
            const { fetchAgentSpam } = await import('./services/spam-service');
            return fetchAgentSpam(ctx.agent.id, ctx.auth!.user.id, input.count);
        }),

    // RESCUE email
    rescueEmail: agentProcedure
        .input(z.object({
            emailId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { rescueAgentEmail } = await import('./services/spam-service');
            return rescueAgentEmail(ctx.agent.id, ctx.auth!.user.id, input.emailId);
        }),

    // SEARCH notion
    searchNotion: agentProcedure
        .input(z.object({
            query: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { searchNotionResources } = await import('./services/notion-service');
            return searchNotionResources(ctx.agent.id, ctx.auth!.user.id, input.query);
        }),

    // CREATE notion page
    createNotionPage: agentProcedure
        .input(z.object({
            title: z.string(),
            content: z.string(),
            parentId: z.string(),
            parentType: z.enum(['database', 'page']),
        }))
        .mutation(async ({ input, ctx }) => {
            const { createNotionPage } = await import('./services/notion-service');
            return createNotionPage(ctx.agent.id, ctx.auth!.user.id, input);
        }),

    // GET focus preferences
    getFocusPreferences: agentProcedure.query(async ({ ctx }) => {
        const { getAgentFocusPreferences } = await import('./services/focus-service');
        return getAgentFocusPreferences(ctx.agent.id, ctx.auth!.user.id);
    }),

    // UPDATE focus preferences
    updateFocusPreferences: agentProcedure
        .input(z.object({
            preferences: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { updateAgentFocusPreferences } = await import('./services/focus-service');
            return updateAgentFocusPreferences(ctx.agent.id, ctx.auth!.user.id, input.preferences);
        }),

    // GET brain settings
    getBrainSettings: agentProcedure.query(async ({ ctx }) => {
        const { getAgentBrainSettings } = await import('./services/brain-service');
        return getAgentBrainSettings(ctx.agent.id, ctx.auth!.user.id);
    }),

    // UPDATE brain settings
    updateBrainSettings: agentProcedure
        .input(z.object({
            type: z.string(),
            content: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { updateAgentBrainSettings } = await import('./services/brain-service');
            return updateAgentBrainSettings(ctx.agent.id, ctx.auth!.user.id, input.type, input.content);
        }),

    // CREATE automation rule
    createRule: agentProcedure
        .input(z.object({
            rule: z.any(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { createAgentRule } = await import('./services/rules-service');
            return createAgentRule(ctx.agent.id, ctx.auth!.user.id, input.rule);
        }),

    // UPDATE automation rule
    updateRule: agentProcedure
        .input(z.object({
            ruleId: z.string(),
            updates: z.any(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { updateAgentRule } = await import('./services/rules-service');
            return updateAgentRule(ctx.agent.id, ctx.auth!.user.id, input.ruleId, input.updates);
        }),

    // DELETE automation rule
    deleteRule: agentProcedure
        .input(z.object({
            ruleId: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {
            const { deleteAgentRule } = await import('./services/rules-service');
            return deleteAgentRule(ctx.agent.id, ctx.auth!.user.id, input.ruleId);
        }),

    // GET activity logs
    getActivityLogs: agentProcedure
        .input(z.object({
            type: z.string().optional(),
        }))
        .query(async ({ input, ctx }) => {
            const { getAgentActivityLogs } = await import('./services/activity-service');
            return getAgentActivityLogs(ctx.agent.id, ctx.auth!.user.id, input.type);
        }),

    // GET focus emails
    getFocusEmails: agentProcedure
        .input(z.object({
            forceRefresh: z.boolean().optional().default(false),
        }))
        .query(async ({ input, ctx }) => {
            const { getAgentFocusEmails } = await import('./services/focus-service');
            return getAgentFocusEmails(ctx.agent.id, ctx.auth!.user.id, input.forceRefresh);
        }),

    // GET connect URL
    getConnectUrl: agentProcedure
        .input(z.object({ provider: z.enum(['gmail', 'jira', 'notion', 'slack', 'dynamics_crm']) }))
        .query(async ({ input, ctx }) => {
            const { generateOAuthState } = await import('@/lib/security/oauth-state');
            const state = await generateOAuthState(ctx.agent.id, input.provider);

            const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

            if (input.provider === 'gmail') {
                const { getGmailOAuthUrl } = await import('@/lib/gmail/oauth');
                const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/oauth-callback`;
                const authUrl = getGmailOAuthUrl(redirectUri);
                return { authUrl: `${authUrl}&state=${encodeURIComponent(state)}` };
            }

            if (input.provider === 'jira') {
                const { getJiraAuthUrl } = await import('@/lib/jira/oauth');
                return { authUrl: getJiraAuthUrl(state) };
            }

            if (input.provider === 'notion') {
                const clientId = process.env.NOTION_CLIENT_ID;
                const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/notion-callback`;
                const authUrl = `https://api.notion.com/v1/oauth/authorize?owner=user&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(state)}`;
                return { authUrl };
            }

            if (input.provider === 'slack') {
                const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
                const redirectUri = `${baseUrl}/api/standalone-agents/gmail-classifier/slack-callback`;
                const scopes = "chat:write,channels:read,groups:read,users:read";
                const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
                return { authUrl };
            }

            return { authUrl: null };
        }),
});
