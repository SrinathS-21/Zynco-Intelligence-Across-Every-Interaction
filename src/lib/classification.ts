import { StoredEmail } from "./types";

const HIGH_PRIORITY_KEYWORDS = [
  "urgent",
  "asap",
  "immediate",
  "critical",
  "production",
  "incident",
  "outage",
  "payment failed",
];

const LOW_PRIORITY_KEYWORDS = ["newsletter", "promotion", "digest", "marketing", "offer"];

export function classifyWithGmailLabels(labels: string[] = []): string | null {
  const lower = labels.map((v) => v.toLowerCase());
  if (lower.includes("important") || lower.includes("category_primary")) return "important";
  if (lower.includes("category_updates")) return "update";
  if (lower.includes("category_promotions")) return "promotion";
  if (lower.includes("category_social")) return "social";
  return null;
}

export function classifyByHeuristics(email: Pick<StoredEmail, "subject" | "snippet" | "from">): string {
  const text = `${email.subject} ${email.snippet}`.toLowerCase();

  if (text.includes("invoice") || text.includes("receipt") || text.includes("payment")) {
    return "finance";
  }

  if (text.includes("meeting") || text.includes("calendar") || text.includes("schedule")) {
    return "meeting";
  }

  if (text.includes("action required") || text.includes("please review") || text.includes("follow up")) {
    return "requires_action";
  }

  if (text.includes("newsletter") || text.includes("offer") || text.includes("promotion")) {
    return "promotion";
  }

  if (email.from.toLowerCase().includes("github")) return "developer";

  return "general";
}

export function calculatePriority(email: Pick<StoredEmail, "subject" | "snippet" | "from" | "labels">): {
  priority: "low" | "medium" | "high" | "critical";
  score: number;
} {
  const text = `${email.subject} ${email.snippet} ${email.from}`.toLowerCase();
  let score = 50;

  if (email.labels?.some((l) => l.toLowerCase() === "important")) score += 20;

  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (text.includes(keyword)) score += 10;
  }

  for (const keyword of LOW_PRIORITY_KEYWORDS) {
    if (text.includes(keyword)) score -= 8;
  }

  if (score >= 90) return { priority: "critical", score };
  if (score >= 70) return { priority: "high", score };
  if (score <= 35) return { priority: "low", score };
  return { priority: "medium", score };
}
