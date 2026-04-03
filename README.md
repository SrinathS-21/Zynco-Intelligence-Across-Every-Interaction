# Zynco Intelligence Across Every Interaction

Unified, AI-assisted communication workspace built with Next.js, Prisma, and modular agent services. The app combines multi-platform social workflows (WhatsApp, Instagram, LinkedIn, X/Twitter), a unified dashboard, a Gmail classifier agent, and AI drafting/chat capabilities.

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Tech Stack](#tech-stack)
4. [Repository Layout](#repository-layout)
5. [Quick Start](#quick-start)
6. [Environment Variables](#environment-variables)
7. [Database Setup (Prisma)](#database-setup-prisma)
8. [Runbook](#runbook)
9. [Routing Guide](#routing-guide)
10. [API Reference (High-Level)](#api-reference-high-level)
11. [Architecture Notes](#architecture-notes)
12. [Security Notes](#security-notes)
13. [Troubleshooting](#troubleshooting)
14. [Deployment Notes](#deployment-notes)

## Overview

Zynco is a communication intelligence platform with:

- Session-based authentication and protected dashboard routing.
- Unified dashboard experience for channel operations.
- Standalone agent infrastructure (notably Gmail Classifier).
- AI text generation endpoints for drafting and chatbot interactions.
- Social integrations for posting/history (LinkedIn, Instagram, X/Twitter).
- WhatsApp utility endpoints for contact/message/rule workflows.

## Core Features

- Unified dashboard with multi-platform views and activity flow.
- Floating AI chatbot on the dashboard with backend-powered responses.
- Gmail classifier agent with configurable rules and integrations.
- AI draft generation endpoint for platform-specific tone/output.
- Social posting + history ingestion for selected channels.
- Session cookies, login/register flows, and optional demo bypass mode.

## Tech Stack

- Framework: Next.js (App Router)
- Language: TypeScript
- UI: React, Tailwind CSS, Radix UI primitives, Framer Motion
- Data: Prisma ORM + PostgreSQL
- Validation: Zod
- Auth: Custom session model (cookie + DB-backed sessions)
- AI providers: Groq (plus optional Gemini usage in some modules)

## Repository Layout

```text
.
├─ src/
│  ├─ app/                       # App Router pages + API routes
│  ├─ components/                # Shared UI components
│  ├─ features/                  # Feature modules (dashboard, agents, onboarding)
│  ├─ lib/                       # Core server/client utilities and integrations
│  ├─ hooks/                     # Reusable React hooks
│  ├─ trpc/                      # Client setup helpers
│  └─ generated/                 # Generated artifacts (e.g., prisma)
├─ prisma/
│  └─ schema.prisma              # DB schema (users, sessions, agents, messages)
├─ public/                       # Static assets
├─ Whatsapp-agent/               # Secondary standalone app (runs separately)
└─ README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create a `.env.local` file in the project root and provide at least:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME"
SESSION_COOKIE_NAME="mail_agent_session"
SESSION_TTL_DAYS="30"

# Optional but recommended for AI endpoints
GROQ_API_KEY="your_groq_api_key"

# App URL helpers
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
```

### 3) Prepare database

```bash
npm run prisma:generate
npm run prisma:push
```

### 4) Start development server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

The codebase references a broad set of optional variables. You only need a subset for local development, but integrations require their matching credentials.

### Required for core app

- `DATABASE_URL`: PostgreSQL connection string.

### Authentication and session

- `SESSION_COOKIE_NAME`: Session cookie key.
- `SESSION_TTL_DAYS`: Session lifetime in days.
- `SESSION_DEMO_BYPASS`: If `true`, auto-provisions and authenticates demo user.
- `DEMO_USER_EMAIL`, `DEMO_USER_NAME`, `DEMO_USER_PASSWORD`: Demo identity values.

### App URL configuration

- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `APP_URL`

### AI providers

- `GROQ_API_KEY`: Used by AI draft/chat and classifier services.
- `GEMINI_API_KEY`: Used by specific automation/agent modules.

### Social and platform integrations

- LinkedIn: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ACCESS_TOKEN`
- Twitter/X: `RAPIDAPI_KEY` or `TWITTER154_API_KEY`
- Instagram: `AYRSHARE_API_KEY`
- Slack: `NEXT_PUBLIC_SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_CLIENT_ID`
- Notion: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`
- Jira: `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`
- Google/Gmail: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Optional data/automation services

- `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`
- `WHAPI_API_TOKEN`
- `MS_DYNAMICS_CLIENT_ID`, `MS_DYNAMICS_CLIENT_SECRET`

## Database Setup (Prisma)

Schema lives at `prisma/schema.prisma` and includes the core models:

- `User`
- `Session`
- `Agent`
- `ScheduledMessage`
- `UnifiedMessage`

Useful commands:

```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:migrate
```

## Runbook

### Main app (root)

- Dev: `npm run dev` (port 3000)
- Build: `npm run build`
- Start: `npm run start`

### Secondary app: Whatsapp-agent

This repository also contains `Whatsapp-agent/`, a separate Next.js app.

```bash
cd Whatsapp-agent
npm install
npm run dev   # runs on port 3001
```

Use this only if you are actively working on that sub-application.

## Routing Guide

### Web routes

- `/` -> redirects to `/login`
- `/login` -> sign-in page
- `/register` -> account creation page
- `/dashboard` -> auth-guarded redirect to `/dashboard/unified`
- `/dashboard/unified` -> primary unified dashboard UI
- `/onboarding` -> onboarding experience

### API routes

Grouped under `src/app/api`:

- Auth:
	- `/api/auth/register`
	- `/api/auth/login`
	- `/api/auth/me`
	- `/api/auth/logout`
- AI:
	- `/api/ai/draft`
	- `/api/ai/chat`
- Channel integrations:
	- `/api/linkedin/*`
	- `/api/twitter/*`
	- `/api/instagram/*`
	- `/api/whatsapp/*`
- Agent backend endpoint:
	- `/api/standalone-agents/gmail-classifier/[...slug]`

## API Reference (High-Level)

### `POST /api/ai/chat`

Purpose: Dashboard chatbot backend.

Request body:

```json
{
	"message": "Summarize my WhatsApp activity",
	"history": [
		{ "role": "user", "content": "..." },
		{ "role": "assistant", "content": "..." }
	]
}
```

Response:

```json
{
	"reply": "...",
	"source": "model"
}
```

If model credentials are unavailable, route returns a deterministic fallback response.

### `POST /api/ai/draft`

Purpose: Platform-specific content drafting from prompt/context (e.g., LinkedIn, X/Twitter, WhatsApp, Instagram).

### `POST /api/auth/login`

Purpose: Validates credentials, creates DB session, sets HttpOnly session cookie.

## Architecture Notes

- App Router pages keep route-level composition in `src/app`.
- Feature modules in `src/features` encapsulate rich domain UI/logic.
- Shared server logic and integration clients are centralized in `src/lib`.
- Prisma schema + generated client provide typed persistence.
- Gmail classifier agent routes are exposed via catch-all endpoint pattern for internal command-style operations.

## Security Notes

- Session cookies are HttpOnly and `secure` in production.
- Never commit secrets to source control.
- Use environment-variable separation per environment (local/staging/prod).
- Review integration routes before enabling production posting permissions.

## Troubleshooting

### App does not start

- Verify Node.js version (`node -v` should be 20+).
- Delete and reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

### Prisma errors

- Confirm `DATABASE_URL` is valid and reachable.
- Regenerate client and sync schema:

```bash
npm run prisma:generate
npm run prisma:push
```

### Chatbot returns fallback responses

- Ensure `GROQ_API_KEY` is set.
- Restart dev server after changing environment variables.

### OAuth callbacks fail

- Ensure callback URL host matches `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL`.
- Check provider app credentials and redirect URI registration.

## Deployment Notes

- Build command: `npm run build`
- Start command: `npm run start`
- Ensure all required env vars are set in deployment platform.
- Run migrations/schema sync against deployment database before first production boot.

---

If you want, I can also add an `.env.example` and a short docs folder (`docs/api.md`, `docs/architecture.md`) so onboarding is even easier for new contributors.
