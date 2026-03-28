"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActivityLog, AutomationRule, StoredEmail } from "@/lib/types";

interface DashboardUser {
  id: string;
  email: string;
  name: string;
}

interface Props {
  user: DashboardUser;
}

function fmt(date: string | undefined | null) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleString();
}

export default function DashboardClient({ user }: Props) {
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<StoredEmail[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [config, setConfig] = useState<any>({});
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [spam, setSpam] = useState<StoredEmail[]>([]);

  const connectedTools = useMemo(() => new Set<string>(config.connectedTools || []), [config.connectedTools]);

  const initAgent = useCallback(async () => {
    setLoading(true);
    setStatus("Initializing agent...");
    try {
      const response = await fetch("/api/standalone-agents/gmail-classifier/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to init agent");

      setAgentId(data.agent.id);
      setStatus("Agent initialized");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Init failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    if (!agentId) return;
    const response = await fetch(`/api/standalone-agents/gmail-classifier/config?agentId=${agentId}`);
    const data = await response.json();
    if (response.ok) setConfig(data.config || {});
  }, [agentId]);

  const loadEmails = useCallback(async () => {
    if (!agentId) return;
    const response = await fetch(`/api/standalone-agents/gmail-classifier/get-emails?agentId=${agentId}`);
    const data = await response.json();
    if (response.ok) {
      setEmails(data.emails || []);
      setStats(data.stats || {});
    }
  }, [agentId]);

  const loadActivity = useCallback(async () => {
    if (!agentId) return;
    const response = await fetch(`/api/standalone-agents/gmail-classifier/activity?agentId=${agentId}&limit=15`);
    const data = await response.json();
    if (response.ok) setLogs(data.logs || []);
  }, [agentId]);

  useEffect(() => {
    initAgent();
  }, [initAgent]);

  useEffect(() => {
    if (!agentId) return;
    void loadConfig();
    void loadEmails();
    void loadActivity();
  }, [agentId, loadConfig, loadEmails, loadActivity]);

  async function connect(provider: "gmail" | "jira" | "notion" | "slack") {
    if (!agentId) return;

    const endpoint =
      provider === "gmail"
        ? "/api/standalone-agents/gmail-classifier/connect-gmail"
        : provider === "jira"
        ? "/api/standalone-agents/gmail-classifier/connect-jira"
        : provider === "notion"
        ? "/api/standalone-agents/gmail-classifier/connect-notion"
        : "/api/standalone-agents/gmail-classifier/connect-slack";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || `Failed to connect ${provider}`);
      return;
    }

    if (data.authUrl) {
      window.location.href = data.authUrl;
    }
  }

  async function syncEmails() {
    if (!agentId) return;
    setLoading(true);
    setStatus("Syncing emails from Gmail...");

    try {
      const response = await fetch("/api/standalone-agents/gmail-classifier/fetch-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, count: 30 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sync failed");

      setEmails(data.emails || []);
      setStats(data.stats || {});
      setStatus(data.message || "Sync complete");
      await loadConfig();
      await loadActivity();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSpam() {
    if (!agentId) return;
    const response = await fetch(`/api/standalone-agents/gmail-classifier/fetch-spam?agentId=${agentId}&count=20`);
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to fetch spam");
      return;
    }
    setSpam(data.spamEmails || []);
  }

  async function rescueEmail(emailId: string) {
    if (!agentId) return;
    const response = await fetch("/api/standalone-agents/gmail-classifier/rescue-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, emailId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to rescue email");
      return;
    }
    setStatus("Email rescued to inbox");
    setSpam((prev) => prev.filter((e) => e.id !== emailId));
    await loadActivity();
  }

  async function addSampleRule() {
    if (!agentId) return;

    const rule: Partial<AutomationRule> = {
      name: "High Priority to Slack",
      enabled: true,
      conditionOperator: "AND",
      conditions: [
        { field: "priority", operator: "equals", value: "high" },
      ],
      action: {
        type: "send_slack_message",
        config: {},
      },
    };

    const response = await fetch("/api/standalone-agents/gmail-classifier/automation-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, rule }),
    });

    const data = await response.json();
    setStatus(response.ok ? `Rule added: ${data.rule?.name}` : data.error || "Failed to add rule");
    await loadConfig();
  }

  async function applyRules(dryRun: boolean) {
    if (!agentId) return;

    const response = await fetch("/api/standalone-agents/gmail-classifier/automation-rules/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, dryRun }),
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || "Failed to apply rules");
      return;
    }

    setStatus(
      dryRun
        ? `Dry run complete: ${data.matched} matched actions`
        : `Rules applied: ${data.executed} executed, ${data.failed} failed`
    );
    await loadActivity();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Mail Agent</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Signed in as {user.name} ({user.email})
          </p>
        </div>
        <div className="row" style={{ width: 240 }}>
          <button className="secondary" onClick={() => window.location.reload()}>
            Refresh
          </button>
          <button className="danger" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <p className="muted">Agent ID: {agentId || "creating..."}</p>
      <p>{status}</p>

      <div className="grid">
        <section className="card grid-6">
          <h2>Connections</h2>
          <p className="muted">No Keycloak / No Polar. Direct OAuth integrations.</p>
          <div className="row" style={{ marginBottom: 8 }}>
            <button onClick={() => connect("gmail")} disabled={loading}>
              {config?.gmailEmail ? `Re-connect Gmail (${config.gmailEmail})` : "Connect Gmail"}
            </button>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="secondary" onClick={() => connect("jira")}>Connect Jira</button>
            <button className="secondary" onClick={() => connect("notion")}>Connect Notion</button>
            <button className="secondary" onClick={() => connect("slack")}>Connect Slack</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["gmail", "jira", "notion", "slack"].map((tool) => (
              <span className="badge" key={tool}>
                {tool}: {connectedTools.has(tool) ? "connected" : "not connected"}
              </span>
            ))}
          </div>
        </section>

        <section className="card grid-6">
          <h2>Sync & Rules</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <button onClick={syncEmails} disabled={loading}>Sync Gmail</button>
            <button className="secondary" onClick={addSampleRule}>Add Sample Rule</button>
          </div>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="secondary" onClick={() => applyRules(true)}>Dry Run Rules</button>
            <button className="secondary" onClick={() => applyRules(false)}>Execute Rules</button>
          </div>
          <div>
            <p className="muted" style={{ margin: 0 }}>
              Total emails: {String((stats as any)?.total || 0)} | Last sync: {fmt((stats as any)?.lastSync || null)}
            </p>
          </div>
        </section>

        <section className="card grid-12">
          <h2>Inbox (Cached)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">No emails yet. Connect Gmail and run sync.</td>
                </tr>
              ) : (
                emails.slice(0, 100).map((email) => (
                  <tr key={email.id}>
                    <td>{fmt(email.date)}</td>
                    <td>{email.from}</td>
                    <td>{email.subject}</td>
                    <td>{email.category}</td>
                    <td>{email.priority}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card grid-6">
          <h2>Spam Rescue</h2>
          <div className="row" style={{ marginBottom: 8 }}>
            <button className="secondary" onClick={fetchSpam}>Fetch Spam</button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>From</th>
                <th>Subject</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {spam.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">No spam loaded.</td>
                </tr>
              ) : (
                spam.map((email) => (
                  <tr key={email.id}>
                    <td>{email.from}</td>
                    <td>{email.subject}</td>
                    <td>
                      <button className="secondary" onClick={() => rescueEmail(email.id)}>Rescue</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="card grid-6">
          <h2>Recent Activity</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">No activity yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>{fmt(log.timestamp)}</td>
                    <td>{log.action}</td>
                    <td>{log.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
