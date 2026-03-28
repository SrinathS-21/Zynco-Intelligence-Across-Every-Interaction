import { ActivityLog, ActivityType } from "./types";

export function createActivityLog(
  type: ActivityType,
  action: string,
  details: string,
  status: "success" | "failed" | "pending" = "success",
  metadata?: Record<string, unknown>
): ActivityLog {
  return {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    action,
    details,
    status,
    timestamp: new Date().toISOString(),
    metadata,
  };
}
