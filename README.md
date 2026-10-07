# Bash — Live Events & Clubs (Next.js)

Next.js 14 (App Router) port of the "Bash" ticket-booking frontend that was originally a Create React App build.

## Run

```bash
npm install
cp .env.example .env     # optional; set BACKEND_URL if your API lives elsewhere
npm run dev              # http://localhost:3000
```

The app expects the original FastAPI backend (`/api/events`, `/api/auth/*`, `/api/bookings/*`).
Browser calls go to `/api/*` on this app, and `next.config.js` proxies them to `BACKEND_URL`
(defaults to the original preview URL, which may expire).

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
