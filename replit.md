# ReadTok — IELTS Reading Practice PWA

## Overview

ReadTok is a TikTok-style IELTS Reading Practice Progressive Web App. Users swipe vertically through full-screen reading cards, each containing a 5-sentence passage and 3 IELTS-style questions with instant feedback.

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

Frontend-first app with embedded IELTS card data and localStorage-backed practice state. Authentication is available for user identity and profile display, while practice progress remains local-first in the MVP.

All 10 IELTS reading cards are embedded in `artifacts/readtok/src/lib/data.ts`. Each question includes exact evidence text that is highlighted in the passage after the learner picks an answer. User progress, saved passages, and stats are persisted in localStorage via `artifacts/readtok/src/hooks/use-app-state.ts`.

The shared API server includes Clerk proxy middleware for production auth support.

## Key Files

- `artifacts/readtok/src/App.tsx` — Main app with routing (/, /saved, /profile, /sign-in, /sign-up) and auth provider setup
- `artifacts/readtok/src/lib/data.ts` — 10 pre-loaded IELTS reading cards with answer evidence
- `artifacts/readtok/src/pages/home.tsx` — TikTok-style vertical feed
- `artifacts/readtok/src/components/reading-card.tsx` — Individual card with passage, questions, feedback, and evidence highlighting
- `artifacts/readtok/src/pages/profile.tsx` — Stats plus signed-in/signed-out account panel
- `artifacts/readtok/src/components/bottom-nav.tsx` — Bottom navigation (Home, Saved, Profile)
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
