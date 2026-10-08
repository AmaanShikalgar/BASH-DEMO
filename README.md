# Bash — Live Events & Clubs (Next.js)

Next.js 14 (App Router) port of the "Bash" ticket-booking frontend that was originally a Create React App build.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL and AUTH_SECRET
npm run dev                  # http://localhost:3000
```

## Database (Neon Postgres)

Users, user-created events, bookings and login-throttle data live in Neon. Seed events stay in `src/data/seedEvents.js`.
Tables are created automatically on the first request; `scripts/schema.sql` (or `npm run db:setup`) does the same by hand.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Add the Neon integration (Vercel > Storage > Neon, or Marketplace). It injects `DATABASE_URL` for you.
3. Add `AUTH_SECRET` (`openssl rand -hex 32`) under Project Settings > Environment Variables.
4. Deploy. Log in with `test@bash.in` / `test1234` (set `DEMO_USER=off` to disable this account).

## Routes

| URL | File |
| --- | --- |
| `/` | `src/app/page.jsx` → `src/views/HomePage.jsx` |
| `/events/[id]` | `src/app/events/[id]/page.jsx` |
| `/book/[id]?tier=VIP` | `src/app/book/[id]/page.jsx` |
| `/tickets` | `src/app/tickets/page.jsx` |
| `/login`, `/register` | `src/app/login`, `src/app/register` |

## What changed from the CRA version

- `react-router-dom` replaced with `next/link` and `next/navigation` (small `useNav` and `NavLink` helpers keep the old call sites unchanged).
- `REACT_APP_BACKEND_URL` replaced by a `/api` rewrite to `BACKEND_URL`.
- Components using hooks or browser APIs are marked `"use client"`.
- `index.css` and `App.css` merged into `src/app/globals.css`; Tailwind config is the default (the original config wasn't in the export).
