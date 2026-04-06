"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Sparkles, UserRoundPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      const emailQuery = encodeURIComponent(email);
      router.push(`/login?registered=1&email=${emailQuery}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute left-0 top-32 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <section className="hidden rounded-3xl border border-border/60 bg-card/60 p-8 backdrop-blur md:block lg:p-10">
          <div className="mb-10 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-cyan-500" />
            Create your Zynco account
          </div>

          <h1 className="text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
            Start with the Zynco unified dashboard.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground lg:text-lg">
            Create credentials to access login, onboarding, dashboard features, and integrated API routes in this project.
          </p>

          <div className="mt-10 grid gap-4">
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Built-in auth routes
              </div>
              <p className="text-sm text-muted-foreground">Registration and login are wired to /api/auth/register and /api/auth/login with session support.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <UserRoundPlus className="h-4 w-4 text-blue-500" />
                Existing feature modules
              </div>
              <p className="text-sm text-muted-foreground">Includes Gmail classifier, AI chat and draft APIs, and social integration routes.</p>
            </div>
          </div>
        </section>

        <Card className="w-full border-border/60 bg-card/95 shadow-2xl shadow-black/5 backdrop-blur">
          <CardHeader className="space-y-2 pb-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300">
              <UserRoundPlus className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">Create Zynco Account</CardTitle>
            <CardDescription>Set up your credentials to unlock the dashboard and agent workspace.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  placeholder="Your name"
                  required
                />
              </div>

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
                <Label htmlFor="password">Password (min 8 chars)</Label>
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                />
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>

            <p className="mt-5 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-sky-600 hover:underline dark:text-sky-300">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
