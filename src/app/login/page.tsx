"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";

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
        <main className="relative min-h-screen overflow-hidden bg-background">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
                <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
                <section className="hidden rounded-3xl border border-border/60 bg-card/60 p-8 backdrop-blur md:block lg:p-10">
                    <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 text-cyan-500" />
                        Zynco Platform
                    </div>

                    <h1 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                        Intelligence across every interaction.
                    </h1>
                    <p className="mt-4 max-w-xl text-base text-muted-foreground lg:text-lg">
                        Sign in to manage Gmail Classifier, AI chat and draft tools, and connected channels from one place.
                    </p>

                    <div className="mt-10 grid gap-4">
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                Session-based auth
                            </div>
                            <p className="text-sm text-muted-foreground">Custom login with DB-backed sessions and protected dashboard routing.</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                            <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                                <Zap className="h-4 w-4 text-blue-500" />
                                Integrated channel APIs
                            </div>
                            <p className="text-sm text-muted-foreground">Instagram, LinkedIn, X/Twitter, dashboard insights, uploads, and agent endpoints are ready.</p>
                        </div>
                    </div>
                </section>

                <Card className="w-full border-border/60 bg-card/95 shadow-2xl shadow-black/5 backdrop-blur">
                    <CardHeader className="space-y-2 pb-4">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                            <Sparkles className="h-5 w-5" />
                        </div>
                        <CardTitle className="text-2xl">Zynco Login</CardTitle>
                        <CardDescription>Welcome back. Sign in to continue to your unified dashboard.</CardDescription>
                    </CardHeader>

                    <CardContent>
                        {registered ? (
                            <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
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
                                    placeholder="you@company.com"
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
                                    placeholder="Enter your password"
                                />
                            </div>

                            {error ? <p className="text-sm text-destructive">{error}</p> : null}

                            <Button type="submit" className="h-11 w-full" disabled={loading}>
                                {loading ? "Signing in..." : "Sign in"}
                            </Button>
                        </form>

                        <p className="mt-5 text-sm text-muted-foreground">
                            New to Zynco?{" "}
                            <Link href="/register" className="font-medium text-cyan-600 hover:underline dark:text-cyan-300">
                                Create account
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
