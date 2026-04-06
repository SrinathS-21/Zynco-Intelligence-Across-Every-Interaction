"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sora, Outfit } from "next/font/google";
import { ArrowRight, Bot, ChartSpline, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const headingFont = Sora({ subsets: ["latin"], weight: ["600", "700", "800"] });
const bodyFont = Outfit({ subsets: ["latin"], weight: ["400", "500", "600"] });

const features = [
  {
    title: "Unified Dashboard",
    description: "Manage Instagram, LinkedIn, X/Twitter, uploads, and activity signals from a single interface.",
    icon: ChartSpline,
    tone: "from-cyan-500/25 to-blue-500/10",
  },
  {
    title: "AI Workflows",
    description: "Use built-in AI chat, content drafting, and strategy endpoints to accelerate daily execution.",
    icon: Bot,
    tone: "from-emerald-500/25 to-teal-500/10",
  },
  {
    title: "Agent Ready",
    description: "Operate Gmail classifier and integration routes with secure session-based authentication.",
    icon: Zap,
    tone: "from-indigo-500/25 to-sky-500/10",
  },
];

export default function HomePage() {
  return (
    <main className={`relative min-h-screen overflow-hidden bg-background ${bodyFont.className}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-foreground) 36%, transparent) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-14 sm:px-8 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="mx-auto w-full text-center"
        >
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
            <Sparkles className="h-4 w-4 text-cyan-500" />
            Zynco Intelligence Across Every Interaction
          </div>

          <h1 className={`mx-auto max-w-4xl text-balance text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl ${headingFont.className}`}>
            One cockpit for your
            <span className="bg-linear-to-r from-cyan-500 via-blue-500 to-emerald-500 bg-clip-text text-transparent"> conversations, content, and AI actions.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            Zynco brings your channels and automation endpoints together so you can monitor, decide, and execute faster.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button size="lg" className="h-12 min-w-45 gap-2 rounded-xl bg-cyan-600 text-white hover:bg-cyan-700">
                Login
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="h-12 min-w-45 rounded-xl border-border/70 bg-card/60 backdrop-blur">
                Create Account
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7, ease: "easeOut" }}
          className="mx-auto mt-12 grid w-full max-w-5xl gap-4 md:grid-cols-3"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + index * 0.08, duration: 0.45 }}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/75 p-5 backdrop-blur"
              >
                <div className={`pointer-events-none absolute inset-0 bg-linear-to-br ${feature.tone} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
                <div className="relative">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-background/80">
                    <Icon className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
                  </div>
                  <h2 className={`text-lg font-semibold ${headingFont.className}`}>{feature.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </section>
    </main>
  );
}
