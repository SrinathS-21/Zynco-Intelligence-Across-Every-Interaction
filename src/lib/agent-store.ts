import { prisma } from "./db";
import { AgentConfig, AgentData, StoredEmail } from "./types";

type AgentRecord = NonNullable<Awaited<ReturnType<typeof prisma.agent.findFirst>>>;

export function defaultStats() {
  return {
    total: 0,
    classified: 0,
    gmailLabelsSuppressed: 0,
    senderRulesSuppressed: 0,
    llmCalled: 0,
    categories: {},
  };
}

export function getConfig(agent: AgentRecord): AgentConfig {
  return ((agent.config as AgentConfig) || {}) as AgentConfig;
}

export function getData(agent: AgentRecord): AgentData {
  return ((agent.data as AgentData) || { emails: [], stats: defaultStats() }) as AgentData;
}

export async function getOrCreateDefaultAgent(userId: string): Promise<AgentRecord> {
  const existing = await prisma.agent.findFirst({
    where: { userId, type: "GMAIL_CLASSIFIER" },
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.agent.create({
    data: {
      userId,
      name: "Email Classifier",
      type: "GMAIL_CLASSIFIER",
      status: "ACTIVE",
      config: {},
      data: {
        emails: [],
        stats: defaultStats(),
      },
    },
  });
}

export async function getUserAgentById(userId: string, agentId: string): Promise<AgentRecord | null> {
  return prisma.agent.findFirst({
    where: {
      id: agentId,
      userId,
      type: "GMAIL_CLASSIFIER",
    },
  });
}

export function mergeEmails(existing: StoredEmail[], incoming: StoredEmail[]): StoredEmail[] {
  const map = new Map<string, StoredEmail>();
  for (const email of existing) map.set(email.id, email);
  for (const email of incoming) map.set(email.id, email);

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
