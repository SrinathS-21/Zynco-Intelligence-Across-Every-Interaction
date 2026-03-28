/**
 * Centralized agent action creator
 * This file handles the creation of all agent types in a scalable way
 */

import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";
import { AGENT_TYPES, AGENT_REGISTRY } from "../lib/agent-registry";

/**
 * Create or retrieve an existing standalone agent
 * This function ensures one agent per type per user
 * Note: Subscription check is performed on the client side before calling this
 */
export async function createOrGetAgent(agentType: string) {
  const session = await requireAuth();
  const userId = session.user.id as string;

  // Validate agent type
  if (!AGENT_REGISTRY[agentType]) {
    throw new Error(`Invalid agent type: ${agentType}`);
  }

  const metadata = AGENT_REGISTRY[agentType];

  // Check if user already has this agent type
  const existingAgent = await prisma.standaloneAgent.findFirst({
    where: { userId, type: agentType },
  });

  if (existingAgent) {
    return existingAgent.id;
  }

  // Create new agent
  const agent = await prisma.standaloneAgent.create({
    data: {
      name: metadata.name,
      userId,
      type: agentType,
      status: "DRAFT",
      config: {},
      data: {},
    },
  });

  return agent.id;
}

/**
 * Helper functions for specific agent types
 * These can add agent-specific initialization logic
 */

export async function createAiLeadGeneratorAgent() {
  return createOrGetAgent(AGENT_TYPES.AI_LEAD_GENERATOR);
}

export async function createColdWriterAgent() {
  return createOrGetAgent(AGENT_TYPES.COLD_WRITER);
}

export async function createFollowUpProAgent() {
  return createOrGetAgent(AGENT_TYPES.FOLLOWUP_PRO);
}

export async function createCrmLoggerAgent() {
  return createOrGetAgent(AGENT_TYPES.CRM_LOGGER);
}

export async function createInsightBotAgent() {
  return createOrGetAgent(AGENT_TYPES.INSIGHT_BOT);
}

export async function createEmailClassifierAgent() {
  return createOrGetAgent(AGENT_TYPES.GMAIL_CLASSIFIER);
}
