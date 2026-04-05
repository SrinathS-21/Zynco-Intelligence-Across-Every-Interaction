"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [registered, setRegistered] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const signupEmail = params.get("email");
        setRegistered(params.get("registered") === "1");
        if (signupEmail) {
            setEmail(signupEmail);
        }
    }, []);

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            let response: Response;
            try {
                response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                });
            } catch {
                setError("Unable to reach the server. Please restart dev server and try again.");
                return;
            }

            let data: { error?: string } = {};
            try {
                data = await response.json();
            } catch {
                // Ignore parse errors so we can still show a fallback status message.
            }

            if (!response.ok) {
                setError(data.error || `Login failed (${response.status})`);
                return;
            }

            router.push("/dashboard");
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen grid place-items-center px-4 bg-gradient-to-b from-background to-muted/30">
            <Card className="w-full max-w-md shadow-md">
                <CardHeader>
                    <CardTitle>Mail Agent Login</CardTitle>
                    <CardDescription>Standalone Gmail Classifier</CardDescription>
                </CardHeader>
                <CardContent>
                    {registered ? (
                        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                            Account created successfully. Please sign in to continue.
                        </p>
                    ) : null}

                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                type="email"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type="password"
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error ? <p className="text-sm text-destructive">{error}</p> : null}

                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Signing in..." : "Sign in"}
                        </Button>
                    </form>

                    <p className="text-sm text-muted-foreground mt-5">
                        New user?{" "}
                        <Link href="/register" className="text-primary hover:underline">
                            Create account
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </main>
    );
}
