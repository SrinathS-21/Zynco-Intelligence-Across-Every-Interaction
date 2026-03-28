"use client";

import { useEffect, useState } from "react";
import EmailClassifierEditor from "@/features/standalone-agents/agents/gmail-classifier/editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
    userId: string;
}

export default function ParityDashboardShell({ userId }: Props) {
    const [agentId, setAgentId] = useState<string>("");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        let mounted = true;
        async function init() {
            try {
                const res = await fetch("/api/standalone-agents/gmail-classifier/init", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to initialize agent");
                if (!mounted) return;
                setAgentId(data.agent.id);
            } catch (e) {
                if (!mounted) return;
                setError(e instanceof Error ? e.message : "Failed to initialize agent");
            }
        }

        void init();
        return () => {
            mounted = false;
        };
    }, [userId]);

    if (error) {
        return (
            <main className="min-h-[50vh] grid place-items-center px-4 py-8">
                <Card className="w-full max-w-2xl border-destructive/40">
                    <CardHeader>
                        <CardTitle>Gmail Classifier Failed To Load</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
            </main>
        );
    }

    if (!agentId) {
        return (
            <main className="min-h-[50vh] grid place-items-center px-4 py-8">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle>Loading Gmail Classifier...</CardTitle>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    return <EmailClassifierEditor agentId={agentId} />;
}
