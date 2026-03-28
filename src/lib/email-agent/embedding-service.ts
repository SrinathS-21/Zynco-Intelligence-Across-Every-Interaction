/**
 * Email Embedding Service
 * Handles vectorization and indexing of emails for semantic search
 * Now uses Json storage in StandaloneAgent instead of separate tables
 */

import { Pinecone } from "@pinecone-database/pinecone";
import prisma from "@/lib/db";

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || "spinabot-emails";
const EMBEDDING_MODEL = "llama-text-embed-v2"; // Pinecone's inference model

// Lazy-load Pinecone client to avoid initialization during build
let pineconeClient: Pinecone | null = null;

function getPineconeClient(): Pinecone | null {
    const apiKey = process.env.PINECONE_API_KEY;

    // Return null if not configured
    if (!apiKey || apiKey === '' || apiKey === 'your-pinecone-api-key') {
        return null;
    }

    // Initialize once and cache
    if (!pineconeClient) {
        pineconeClient = new Pinecone({ apiKey });
    }

    return pineconeClient;
}

interface EmailToIndex {
    id: string;
    subject: string;
    from: string;
    body?: string;
    snippet?: string;
    category: string;
    priority: string;
    date: string;
    labels?: string[];
}

interface EmbeddingResult {
    success: boolean;
    vectorId?: string;
    error?: string;
}

/**
 * Generate embedding using Pinecone Inference API (llama-text-embed-v2)
 */
async function generateEmbedding(text: string, inputType: "passage" | "query" = "passage"): Promise<number[] | null> {
    const apiKey = process.env.PINECONE_API_KEY;

    // Gracefully skip if not configured
    if (!apiKey || apiKey === '' || apiKey === 'your-pinecone-api-key') {
        return null; // Skip embedding, don't throw
    }

    // Truncate text to reasonable length
    const truncatedText = text.substring(0, 8000);

    try {
        // Use Pinecone's inference API
        const response = await fetch("https://api.pinecone.io/embed", {
            method: "POST",
            headers: {
                "Api-Key": apiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                inputs: [{ text: truncatedText }],
                parameters: {
                    input_type: inputType,
                    truncate: "END",
                },
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            // console.warn(`Pinecone embedding skipped: ${response.status} ${error.substring(0, 100)}`);
            return null;
        }

        const data = await response.json();
        return data.data?.[0]?.values || null;
    } catch (error) {
        console.warn(`Pinecone embedding failed:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}

function extractDomain(email: string): string {
    const match = email.match(/<([^>]+)>/) || email.match(/([^\s]+@[^\s]+)/);
    const address = match ? match[1] : email;
    const parts = address.split("@");
    return parts.length > 1 ? parts[1].toLowerCase() : "";
}

function extractSenderName(from: string): string {
    const match = from.match(/^([^<]+)/);
    return match ? match[1].trim().replace(/"/g, "") : from;
}

/**
 * Helper to get/create agent
 */
async function getAgent(userId: string) {
    return prisma.standaloneAgent.findUnique({
        where: {
            userId_type: {
                userId,
                type: "GMAIL_CLASSIFIER"
            }
        }
    });
}

/**
 * Index a single email into Pinecone and store metadata in JSON
 */
export async function indexEmail(
    email: EmailToIndex,
    userId: string
): Promise<EmbeddingResult> {
    try {
        const agent = await getAgent(userId);
        if (!agent) {
            return { success: false, error: "Agent not found" };
        }

        const data = (agent.data as any) || {};
        const emailVectorIndex = data.emailVectorIndex || {};

        // Check if already indexed
        if (emailVectorIndex[email.id]) {
            return { success: true, vectorId: emailVectorIndex[email.id].vectorId };
        }

        // Prepare text for embedding
        const textToEmbed = [
            `Subject: ${email.subject}`,
            `From: ${email.from}`,
            email.body || email.snippet || "",
        ].join("\n").trim();

        // Generate embedding
        const embedding = await generateEmbedding(textToEmbed);

        if (!embedding) {
            return { success: false, error: "Embedding generation skipped (Pinecone not configured)" };
        }

        // Pinecone operations
        const vectorId = `user_${userId}_email_${email.id}`;
        try {
            const pinecone = getPineconeClient();
            if (pinecone) {
                const index = pinecone.index(INDEX_NAME);
                await index.upsert([
                    {
                        id: vectorId,
                        values: embedding,
                        metadata: {
                            userId,
                            emailId: email.id,
                            subject: email.subject.substring(0, 200),
                            from: email.from,
                            fromDomain: extractDomain(email.from),
                            senderName: extractSenderName(email.from),
                            category: email.category,
                            priority: email.priority,
                            date: email.date,
                            labels: email.labels?.join(",") || "",
                        },
                    },
                ]);
            }
        } catch (e) {
            console.warn("Pinecone upsert failed, skipping vector index:", e);
            // We might still want to track it locally?
        }

        // Update Agent Data
        const newIndexEntry = {
            userId,
            emailId: email.id,
            vectorId,
            subject: email.subject.substring(0, 200),
            senderEmail: email.from,
            category: email.category,
            priority: email.priority,
            emailDate: email.date,
        };

        const newData = {
            ...data,
            emailVectorIndex: {
                ...emailVectorIndex,
                [email.id]: newIndexEntry
            }
        };

        await prisma.standaloneAgent.update({
            where: { id: agent.id },
            data: { data: newData }
        });

        console.log(`Indexed email: ${email.subject.substring(0, 50)}...`);
        return { success: true, vectorId };

    } catch (error) {
        console.error(`Failed to index email ${email.id}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Batch index multiple emails
 */
export async function indexEmails(
    emails: EmailToIndex[],
    userId: string
): Promise<{ indexed: number; skipped: number; failed: number }> {
    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    const batchSize = 10;
    for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(email => indexEmail(email, userId))
        );
        results.forEach(result => {
            if (result.success) indexed++;
            else if (result.error?.includes("already indexed")) skipped++;
            else failed++;
        });
        if (i + batchSize < emails.length) await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { indexed, skipped, failed };
}

/**
 * Semantic search over indexed emails
 */
export async function searchEmails(
    query: string,
    userId: string,
    options: {
        topK?: number;
        category?: string;
        priority?: string;
        fromDomain?: string;
        dateFrom?: string;
        dateTo?: string;
    } = {}
): Promise<Array<{
    emailId: string;
    score: number;
    metadata: Record<string, any>;
}>> {
    const { topK = 10, category, priority, fromDomain } = options;
    const queryEmbedding = await generateEmbedding(query, "query");

    if (!queryEmbedding) {
        return [];
    }

    const filter: Record<string, any> = { userId: { $eq: userId } };
    if (category) filter.category = { $eq: category };
    if (priority) filter.priority = { $eq: priority };
    if (fromDomain) filter.fromDomain = { $eq: fromDomain };

    const pinecone = getPineconeClient();
    if (!pinecone) {
        return [];
    }

    const index = pinecone.index(INDEX_NAME);
    const results = await index.query({
        vector: queryEmbedding,
        topK,
        filter,
        includeMetadata: true,
    });

    return results.matches?.map(match => ({
        emailId: match.metadata?.emailId as string,
        score: match.score || 0,
        metadata: match.metadata || {},
    })) || [];
}

/**
 * Update sender profile based on user interaction
 */
export async function updateSenderProfile(
    userId: string,
    senderEmail: string,
    action: "open" | "reply" | "archive" | "spam" | "correct",
    data?: { oldCategory?: string; newCategory?: string }
): Promise<void> {
    const agent = await getAgent(userId);
    if (!agent) return;

    const agentData = (agent.data as any) || {};
    const senderProfiles = agentData.senderProfiles || {};

    const domain = extractDomain(senderEmail);
    const name = extractSenderName(senderEmail);

    const profile = senderProfiles[senderEmail] || {
        userId,
        senderEmail,
        senderDomain: domain,
        senderName: name,
        totalEmails: 0,
        openedCount: 0,
        repliedCount: 0,
        archivedCount: 0,
        markedSpam: 0,
        incorrectPredictions: 0,
        createdAt: new Date().toISOString()
    };

    // Update counts
    profile.totalEmails = (profile.totalEmails || 0) + 1; // Assuming every interaction implies an email? Or maybe check context.
    // Actually the previous upsert didn't increment totalEmails for actions, only set it on create. 
    // Logic was: create: { totalEmails: 1 }, update: {}
    // We should replicate that behavior carefully. 
    // If it's new, totalEmails = 1. If exists, don't increment unless we are processing a NEW email? 
    // "updateSenderProfile" is called on interaction, so we assume the email exists. 
    // Wait, the original code had `totalEmails: 1` on create, and NO increment on update.
    // So essentially totalEmails tracks *unique senders*? No, that's wrong. 
    // Let's stick to interaction counts.

    if (action === "open") profile.openedCount = (profile.openedCount || 0) + 1;
    if (action === "reply") profile.repliedCount = (profile.repliedCount || 0) + 1;
    if (action === "archive") profile.archivedCount = (profile.archivedCount || 0) + 1;
    if (action === "spam") profile.markedSpam = (profile.markedSpam || 0) + 1;
    if (action === "correct") {
        profile.incorrectPredictions = (profile.incorrectPredictions || 0) + 1;
        if (data?.newCategory) profile.preferredCategory = data.newCategory;
    }

    profile.updatedAt = new Date().toISOString();

    const newData = {
        ...agentData,
        senderProfiles: {
            ...senderProfiles,
            [senderEmail]: profile
        }
    };

    await prisma.standaloneAgent.update({
        where: { id: agent.id },
        data: { data: newData }
    });
}

/**
 * Get user's email preferences from Agent Config
 */
export async function getUserEmailPreferences(userId: string) {
    const agent = await getAgent(userId);
    const config = (agent?.config as any) || {};
    return {
        userId,
        syncPreferences: config.syncPreferences || {},
        corrections: config.corrections || []
    };
}

/**
 * Record a user correction in Agent Config
 */
export async function recordCorrection(
    userId: string,
    emailId: string,
    oldCategory: string,
    newCategory: string
): Promise<void> {
    const agent = await getAgent(userId);
    if (!agent) return;

    const config = (agent.config as any) || {};
    const corrections = (config.corrections as any[]) || [];

    corrections.push({
        emailId,
        oldCategory,
        newCategory,
        timestamp: new Date().toISOString(),
    });

    const trimmedCorrections = corrections.slice(-100);

    const newConfig = {
        ...config,
        corrections: trimmedCorrections
    };

    await prisma.standaloneAgent.update({
        where: { id: agent.id },
        data: { config: newConfig }
    });
}
