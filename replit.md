# ReadTok — IELTS Reading Practice PWA

## Overview

ReadTok is a TikTok-style IELTS Reading Practice Progressive Web App. Users swipe vertically through full-screen reading cards, each containing a short passage and IELTS-style questions with instant feedback.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Routing**: wouter
- **Authentication**: Clerk-backed sign-in/sign-up with in-app `/sign-in` and `/sign-up` routes
- **Animations**: framer-motion
- **Icons**: lucide-react
- **State**: React hooks + localStorage for practice progress, saved cards, onboarding, and stats
- **PWA**: manifest.json + service worker

## Architecture

Frontend-first app with a lightweight static reading-material database and localStorage-backed practice state. Authentication is available for user identity and profile display, while practice progress remains local-first in the MVP.

The reading source is `artifacts/readtok/src/lib/reading-material-db.json`, currently using the uploaded IELTS Reading v1.0 schema. `artifacts/readtok/src/lib/data.ts` adapts that JSON into app-ready cards by mapping each raw card `topic` to the visible passage title, joining questions with their `answer_key` entries, formatting MCQ and TFNG answer choices, mapping band level to difficulty, and deriving evidence sentences for feedback highlighting.

The feed pulls randomized batches from this static database on initial load and whenever users scroll near the end. Multiple-choice and true/false/not-given questions are supported for the current schema. After a user answers, the card shows the correct answer and the explanation from the answer key. User progress, saved passages, and stats are persisted in localStorage via `artifacts/readtok/src/hooks/use-app-state.ts`.

The shared API server includes Clerk proxy middleware for production auth support.

## Key Files

- `artifacts/readtok/src/App.tsx` — Main app with routing (/, /saved, /profile, /sign-in, /sign-up) and auth provider setup
- `artifacts/readtok/src/lib/reading-material-db.json` — Static 40-card IELTS Reading database using the v1.0 schema
- `artifacts/readtok/src/lib/data.ts` — Adapter that transforms the static JSON database into app-ready reading cards
- `artifacts/readtok/src/pages/home.tsx` — TikTok-style vertical feed that appends random cards while scrolling
- `artifacts/readtok/src/components/reading-card.tsx` — Individual card with passage, questions, correct answer display, explanations, and evidence highlighting
- `artifacts/readtok/src/pages/profile.tsx` — Stats plus signed-in/signed-out account panel
- `artifacts/readtok/src/components/bottom-nav.tsx` — Black bottom navigation (Feed, Saved, Profile)
- `artifacts/readtok/src/components/onboarding.tsx` — First-visit welcome screen for the feed route
- `artifacts/readtok/src/hooks/use-app-state.ts` — localStorage-based state management
- `artifacts/readtok/public/manifest.json` — PWA manifest
- `artifacts/readtok/public/sw.js` — Service worker for offline caching
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — Production auth proxy middleware
- `artifacts/api-server/src/app.ts` — API server middleware wiring

## Key Commands

- `pnpm --filter @workspace/readtok run dev` — run ReadTok locally
- `pnpm --filter @workspace/api-server run dev` — run API/auth proxy server locally
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
