/**
 * Main Editor - Redesigned with SpinaBOT UI
 * Uses SpinaBOT's design system throughout
 */

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2Icon, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StandaloneAgentEditorProps } from "../../lib/get-standalone-agent-editor";
import { ActivityLogger } from "@/lib/activity-logger";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CredentialType } from "@/generated/prisma";
import {
    getIntegration,
    getConnectionStates,
    buildDisconnectPatch,
    type IntegrationId,
    type IntegrationDefinition,
} from "@/lib/integrations";

// Import components
import { StepProgress } from "./components/StepProgress";
import { EmailProviderStep } from "./components/onboarding/EmailProviderStep";
import { SuccessModal } from "./components/onboarding/SuccessModal";
import { ToolsConnectionStep } from "./components/onboarding/ToolsConnectionStep";
import { KnowledgeBaseStep } from "./components/onboarding/KnowledgeBaseStep";
import { QuizStep, type QuizAnswers } from "./components/onboarding/QuizStep";
import { SetupDashboard } from "./components/onboarding/SetupDashboard";
import { SecurityTermsStep } from "./components/onboarding/SecurityTermsStep";
import { EmailDashboard } from "./components/dashboard/EmailDashboard";

interface OnboardingState {
    currentStep: number;
    emailProvider: "gmail" | "outlook" | "zoho" | null;
    emailConnected: boolean;
    jiraConnected: boolean;
    notionConnected: boolean;
    slackConnected: boolean;
    crmConnected: boolean;
    userEmail: string;
    connectedTools: string[];
    quizAnswers: QuizAnswers | null;
    onboardingComplete: boolean;
    isEditing: boolean;
}

export default function EmailClassifierEditor(props: StandaloneAgentEditorProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [isLoading, setIsLoading] = useState(true);

    // Fetch agent data using tRPC
    const agentQuery = useQuery({
        ...trpc.standaloneAgents.get.queryOptions({ id: props.agentId }),
        enabled: !!props.agentId,
    });

    const updateConfigMutation = useMutation(trpc.standaloneAgents.updateConfig.mutationOptions());

    const crmCredentialsQuery = useQuery({
        ...trpc.credentials.getByType.queryOptions({
            type: CredentialType.MS_DYNAMICS_CRM
        }),
        enabled: !!props.agentId,
    });

    const [onboarding, setOnboarding] = useState<OnboardingState>({
        currentStep: 6, // Default to Setup Dashboard step index
        emailProvider: null,
        emailConnected: false,
        jiraConnected: false,
        notionConnected: false,
        slackConnected: false,
        crmConnected: false,
        userEmail: "",
        connectedTools: [],
        quizAnswers: null,
        onboardingComplete: false,
        isEditing: false,
    });

    // Load onboarding state from agent data
    useEffect(() => {
        if (!agentQuery.data) return;

        const agentData = agentQuery.data;

        // Check if we just completed OAuth (from URL parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const justConnected = urlParams.has('connected');
        const jiraConnected = urlParams.has('jira_connected');
        const notionConnected = urlParams.has('notion_connected');
        const slackConnected = urlParams.has('success') && urlParams.get('success') === 'slack_connected';
        const crmConnected = urlParams.has('crm_connected');

        const config = (agentData.config as Record<string, any>) || {};
        const gmailEmail = config.gmailEmail;

        // Use registry to check all connection states
        const connectionStates = getConnectionStates(config);

        console.log("[Editor] Loaded state:", {
            connectionStates,
            email: gmailEmail,
            justConnected
        });

        // Determine initial step based on DB completion status
        const hasCompletedTools = config.toolsCompleted === true;
        const hasCompletedKnowledgeBase = config.knowledgeBase?.completed === true;
        const hasCompletedQuiz = config.quizCompleted === true;
        const hasCompletedOnboarding = config.onboardingComplete === true;
        const hasRealToken = connectionStates.gmail;
        const hasCrmCredential = connectionStates.dynamics_crm;

        let initialStep = 6; // Default: Setup Dashboard
        let showOnboarding = true;

        if (hasCompletedOnboarding) {
            initialStep = 6;
            showOnboarding = false;

            // Show success toasts for any OAuth callbacks
            if (jiraConnected) setTimeout(() => toast.success("Jira connected successfully!"), 100);
            if (notionConnected) setTimeout(() => toast.success("Notion connected successfully!"), 100);
            if (slackConnected) setTimeout(() => toast.success("Slack connected successfully!"), 100);
            if (crmConnected) setTimeout(() => toast.success("Dynamics CRM connected successfully!"), 100);
            if (justConnected) setTimeout(() => toast.success("Gmail reconnected successfully!"), 100);
        } else if (justConnected) {
            initialStep = 2;
        } else if (jiraConnected || notionConnected || slackConnected || crmConnected) {
            initialStep = 3;
        } else if (!hasRealToken) {
            initialStep = 1;
        } else if (!hasCompletedTools) {
            initialStep = 3;
        } else if (!hasCompletedKnowledgeBase) {
            initialStep = 4;
        } else if (!hasCompletedQuiz) {
            initialStep = 5;
        } else {
            initialStep = 6;
        }

        setOnboarding((prev) => ({
            ...prev,
            emailConnected: !!connectionStates.gmail,
            jiraConnected: !!connectionStates.jira,
            notionConnected: !!connectionStates.notion,
            slackConnected: !!connectionStates.slack,
            crmConnected: !!connectionStates.dynamics_crm,
            userEmail: gmailEmail || "",
            emailProvider: config.emailProvider || "gmail",
            connectedTools: config.connectedTools || [],
            quizAnswers: config.preferences || null,
            currentStep: initialStep,
            isEditing: showOnboarding,
        }));

        // Clean up URL parameters
        if (justConnected || jiraConnected || notionConnected || slackConnected || crmConnected) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        setIsLoading(false);
    }, [agentQuery.data, props.agentId]);

    // Handle email provider selection... (unchanged)
    const handleConnectGmail = async () => {
        console.log("[Editor] Initiating Gmail connection for agent:", props.agentId);
        toast.info("Connecting to Google...");
        try {
            const data = await queryClient.fetchQuery(
                trpc.standaloneAgents.getConnectUrl.queryOptions({
                    id: props.agentId,
                    provider: 'gmail'
                })
            );

            if (data?.authUrl) {
                console.log("[Editor] Redirecting to Google...");
                window.location.href = data.authUrl;
            } else {
                console.error("[Editor] No authUrl in response:", data);
                toast.error("Failed to get authorization URL");
            }
        } catch (error) {
            console.error("[Editor] Connection error:", error);
            toast.error("Failed to initiate connection");
        }
    };

    const handleProviderSelect = async (provider: "gmail" | "outlook" | "zoho") => {
        handleConnectGmail();
    };

    const handleSuccessModalContinue = () => {
        setOnboarding((prev) => ({ ...prev, currentStep: 3 }));
    };

    // Handle tool connection — tRPC powered, single handler for all OAuth integrations
    const handleToolConnect = async (toolId: string) => {
        const integration = getIntegration(toolId as IntegrationId);

        if (integration?.type === 'oauth') {
            try {
                const data = await queryClient.fetchQuery(
                    trpc.standaloneAgents.getConnectUrl.queryOptions({
                        id: props.agentId,
                        provider: toolId as any
                    })
                );

                if (data?.authUrl) {
                    window.location.href = data.authUrl;
                    return;
                }
            } catch (error) {
                console.error(`Error connecting ${toolId}:`, error);
                toast.error(`Failed to connect ${integration?.name || toolId}`);
                return;
            }
        }

        // For unregistered tools or non-oauth, add to connectedTools directly
        setOnboarding((prev) => ({
            ...prev,
            connectedTools: [...prev.connectedTools, toolId],
        }));
        toast.success(`${integration?.name || toolId} connected!`);
    };

    // ─── Generic Disconnect Handler (registry-driven) ──────────────────
    // Replaces 5 near-identical disconnect handlers with one generic function.
    const handleDisconnect = async (integrationId: IntegrationId) => {
        const integration = getIntegration(integrationId);
        if (!integration) {
            toast.error(`Unknown integration: ${integrationId}`);
            return;
        }

        try {
            const patch = buildDisconnectPatch(integration, onboarding.connectedTools);

            await updateConfigMutation.mutateAsync({
                id: props.agentId,
                config: patch.config
            });

            setOnboarding((prev) => {
                const updated = { ...prev };
                // Set the onboarding state key to false
                (updated as any)[integration.onboardingStateKey] = false;
                // Remove from connectedTools if tracked
                if (integration.trackedInConnectedTools) {
                    updated.connectedTools = prev.connectedTools.filter(t => t !== integration.id);
                }
                // Gmail-specific cleanup
                if (integrationId === 'gmail') {
                    updated.userEmail = "";
                    updated.emailProvider = null;
                }
                return updated;
            });
            toast.success(`${integration.name} disconnected successfully`);
            ActivityLogger.disconnected(props.agentId, integration.activityLogTool);
        } catch (error) {
            console.error(`Error disconnecting ${integration.name}:`, error);
            toast.error(`Failed to disconnect ${integration.name}`);
        }
    };

    // Convenience wrappers for the EmailDashboard props interface
    const handleDisconnectJira = () => handleDisconnect('jira');
    const handleDisconnectGmail = () => handleDisconnect('gmail');
    const handleDisconnectNotion = () => handleDisconnect('notion');
    const handleDisconnectSlack = () => handleDisconnect('slack');
    const handleDisconnectCrm = () => handleDisconnect('dynamics_crm');

    // Handle CRM connect — special case: uses credential system, not simple OAuth
    const handleConnectCrm = async () => {
        try {
            // Use already fetched credentials from useQuery
            const credentials = crmCredentialsQuery.data;

            if (credentials && credentials.length > 0) {
                // Use first available credential
                const credentialId = credentials[0].id;
                await updateConfigMutation.mutateAsync({
                    id: props.agentId,
                    config: {
                        msDynamics: { credentialId },
                    }
                });

                setOnboarding((prev) => ({ ...prev, crmConnected: true }));
                ActivityLogger.connected(props.agentId, 'dynamics_crm');
                toast.success('Dynamics CRM connected!');
            } else {
                // No credential found, redirect to OAuth
                const currentUrl = window.location.href.split('?')[0];
                window.location.href = `/api/oauth/ms-dynamics/authorize?redirect=${encodeURIComponent(currentUrl + '?crm_connected=true')}`;
            }
        } catch (error) {
            console.error('Error connecting CRM:', error);
            toast.error('Failed to connect CRM');
        }
    };

    // Handle tools step continue
    const handleToolsContinue = async () => {
        // Save tools
        await updateConfigMutation.mutateAsync({
            id: props.agentId,
            config: { connectedTools: onboarding.connectedTools, toolsCompleted: true }
        });

        setOnboarding((prev) => ({ ...prev, currentStep: 4 })); // Go to Knowledge Base
    };

    // Handle knowledge base
    const handleKnowledgeBaseContinue = async (data: any) => {
        // Save KB
        await updateConfigMutation.mutateAsync({
            id: props.agentId,
            config: {
                knowledgeBase: { ...data, completed: true, updatedAt: new Date().toISOString() }
            }
        });
        setOnboarding((prev) => ({ ...prev, currentStep: 5 })); // Go to Quiz
    };

    // Handle quiz
    const handleQuizComplete = async (answers: QuizAnswers) => {
        await updateConfigMutation.mutateAsync({
            id: props.agentId,
            config: { preferences: answers, quizCompleted: true, onboardingComplete: true }
        });
        setOnboarding((prev) => ({ ...prev, quizAnswers: answers, currentStep: 6 }));
    };

    // SETUP Dashboard Actions
    const handleOpenDashboard = () => {
        // Go to final security check before launching
        setOnboarding((prev) => ({ ...prev, currentStep: 7 }));
    };

    const handleAcceptSecurity = async () => {
        // Mark security as accepted if needed for DB, for now just launch
        await updateConfigMutation.mutateAsync({
            id: props.agentId,
            config: { securityAccepted: true }
        });
        setOnboarding((prev) => ({ ...prev, isEditing: false }));
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2Icon className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // MAIN VIEW LOGIC
    if (!onboarding.isEditing) {
        return (
            <div className="h-[calc(100vh-3.5rem)] overflow-hidden min-w-0 relative bg-background">
                <EmailDashboard
                    agentId={props.agentId}
                    isConnected={onboarding.emailConnected}
                    isJiraConnected={onboarding.jiraConnected}
                    isNotionConnected={onboarding.notionConnected}
                    isSlackConnected={onboarding.slackConnected}
                    isCrmConnected={onboarding.crmConnected}
                    userEmail={onboarding.userEmail}
                    onConnect={handleConnectGmail}
                    onConnectJira={() => handleToolConnect('jira')}
                    onConnectNotion={() => handleToolConnect('notion')}
                    onConnectSlack={() => handleToolConnect('slack')}
                    onConnectCrm={handleConnectCrm}
                    onDisconnectJira={handleDisconnectJira}
                    onDisconnectGmail={handleDisconnectGmail}
                    onDisconnectNotion={handleDisconnectNotion}
                    onDisconnectSlack={handleDisconnectSlack}
                    onDisconnectCrm={handleDisconnectCrm}
                    onOpenSettings={() => setOnboarding(prev => ({ ...prev, isEditing: true, currentStep: 6 }))}
                />
            </div>
        );
    }

    // SETUP / ONBOARDING VIEW
    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex-1 overflow-auto">
                <div className="px-6 py-8 max-w-[1200px] mx-auto">
                    {/* Only show progress if NOT in dashboard view (handled by isEditing check above) */}

                    {/* Back Button to Dashboard */}
                    <div className="mb-6 flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOnboarding(prev => ({ ...prev, isEditing: false }))}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Exit Setup
                            <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                        </Button>
                    </div>

                    {/* Step Content */}
                    {onboarding.currentStep === 1 && (
                        <EmailProviderStep onSelect={handleProviderSelect} />
                    )}

                    {onboarding.currentStep === 2 && onboarding.userEmail && (
                        <SuccessModal
                            userEmail={onboarding.userEmail}
                            provider={onboarding.emailProvider || "Gmail"}
                            onContinue={handleSuccessModalContinue}
                        />
                    )}

                    {onboarding.currentStep === 3 && (
                        <ToolsConnectionStep
                            userEmail={onboarding.userEmail}
                            connectedTools={onboarding.connectedTools}
                            onToolConnect={handleToolConnect}
                            onContinue={handleToolsContinue}
                            onBack={() => setOnboarding(prev => ({ ...prev, currentStep: 6 }))}
                        />
                    )}

                    {onboarding.currentStep === 4 && (
                        <KnowledgeBaseStep
                            onContinue={handleKnowledgeBaseContinue}
                            onBack={() => setOnboarding(prev => ({ ...prev, currentStep: 6 }))}
                        />
                    )}

                    {onboarding.currentStep === 5 && (
                        <QuizStep
                            onComplete={handleQuizComplete}
                            onBack={() => setOnboarding(prev => ({ ...prev, currentStep: 6 }))}
                        />
                    )}

                    {onboarding.currentStep === 6 && (
                        <SetupDashboard
                            userEmail={onboarding.userEmail}
                            connectedTools={onboarding.connectedTools}
                            preferences={onboarding.quizAnswers ? {
                                organizationType: onboarding.quizAnswers.organizationType,
                                emailVolume: onboarding.quizAnswers.emailVolume,
                                primaryRole: onboarding.quizAnswers.primaryRole,
                                responseTime: onboarding.quizAnswers.responseTime,
                                primaryPriority: onboarding.quizAnswers.primaryPriority,
                            } : {}}
                            onOpenDashboard={handleOpenDashboard}
                            onManageTools={() => setOnboarding(prev => ({ ...prev, currentStep: 3 }))}
                            onManageKnowledgeBase={() => setOnboarding(prev => ({ ...prev, currentStep: 4 }))}
                            onRetakeQuiz={() => setOnboarding(prev => ({ ...prev, currentStep: 5 }))}
                        />
                    )}

                    {onboarding.currentStep === 7 && (
                        <SecurityTermsStep
                            onAccept={handleAcceptSecurity}
                            onBack={() => setOnboarding(prev => ({ ...prev, currentStep: 6 }))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
