# Chapter Tracker

Chapter Tracker imports a browser bookmark export, keeps links from supported manga and manhwa sites, and shows whether a newer chapter is available. It is designed to work without an account: each library belongs to the browser that created it.

## Live demo

[Open Chapter Tracker](https://bookmark-manager-zeta.vercel.app/)

The deployed frontend has been checked on September 28, 2026:

- The landing page loads correctly.
- Client-side navigation to the empty Library view works and creates/uses the anonymous session.
- Imports were not tested against a personal bookmark export in the public deployment.

### Known deployment issue

The `/home` route works through client-side navigation but returns a Vercel `404` when opened directly or refreshed. Add this file at `frontend/vercel.json`, commit it, and redeploy:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This lets React Router handle `/home` after Vercel has served the app shell.

## What it does

- Imports `.html` bookmark exports from Chrome, Firefox, Safari, and Edge.
- Recognizes supported series links, retrieves the latest chapter, and saves the result in a private library.
- Rechecks saved series when the library opens and highlights new chapters.
- Keeps the session in an HTTP-only cookie; no email address or password is required.
- Uses per-site request limits and Redis caching to reduce unnecessary scraping.

## How it works

```text
Browser bookmark export
        |
        v
React + Vite frontend
        |
        | POST /bookmark/import (credentialed request)
        v
NestJS API
  |-- reads and filters bookmark links
  |-- matches a supported site and extracts its series slug
  |-- scrapes the latest chapter with safe per-site concurrency
  |-- caches scrape results in Redis for 10 minutes
  '-- saves bookmarks and chapter state in PostgreSQL
        |
        v
Library displays imported series and new-chapter updates
```

### Guest-session flow

1. The frontend requests `GET /auth/session`.
2. A first-time visitor receives `401`, which simply means no guest cookie exists yet.
3. The frontend creates one with `POST /auth/guest`.
4. The backend creates a guest user, signs a JWT, and returns an HTTP-only `jwtAuthToken` cookie.
5. Later API requests include that cookie, so the guard can scope every bookmark query to that guest user.

The `401` on the first check is expected. A `404` during startup usually means the frontend called the wrong session-creation route; it must call `/auth/guest`, not `/auth`.

## Supported sources

| Source | URL pattern |
| --- | --- |
| AsuraScans | `asurascans.com/comics/<series>` |
| KingOfShojo | `kingofshojo.com/manga/<series>` |

Links from all other sites are deliberately skipped and reported in the import summary. This avoids saving links that cannot be reliably checked.

## Tech stack

- Frontend: React, Vite, TypeScript, TanStack Query, Axios, Tailwind CSS
- Backend: NestJS, TypeScript, Prisma, JWT, cookie-parser
- Database: PostgreSQL in production (Neon recommended)
- Cache: Redis (Upstash recommended)
- Hosting: Vercel for the frontend and Render for the backend

## Development setup

### Prerequisites

- Node.js 20 or newer
- PostgreSQL (or the existing local SQLite setup while developing before the production migration)
- Redis, or a reachable Upstash Redis database

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
printf 'VITE_API_URL=http://localhost:4000\n' > .env
npm run dev
```

The frontend runs at `http://localhost:5173` and the API normally runs at `http://localhost:4000`. This is for contributor development only; the application is intended to be deployed.

## Production deployment

Use this deployment shape:

```text
Vercel frontend  ->  Render NestJS API  ->  Neon Postgres
                                        ->  Upstash Redis
```

Before deploying, migrate the Prisma datasource from SQLite to PostgreSQL, use the PostgreSQL Prisma driver adapter, and generate a fresh PostgreSQL migration. Never put production credentials in Git.

Set these backend variables in Render:

```text
NODE_ENV=production
DATABASE_URL=<Neon pooled PostgreSQL URL>
REDIS_URL=<Upstash TCP rediss:// URL>
JWT_SECRET=<new long random secret>
FRONTEND_URL=https://<your-vercel-domain>
CROSS_SITE_AUTH=true
```

Set this Vercel build variable:

```text
VITE_API_URL=https://<your-render-api-domain>
```

Use HTTPS for both deployments. Cross-site authentication requires `SameSite=None; Secure` cookies, which browsers only send over HTTPS.

For Vercel, use `frontend` as the project root directory, `npm run build` as the build command, and `dist` as the output directory. Add the SPA rewrite shown in the Live demo section so direct links and browser refreshes work.

## Source roadmap

Future source support should be added only after checking each site's terms, robots guidance, rate limits, and whether an official API is available. Prefer official platforms and APIs where possible. Each site needs a URL matcher, scraper, tests, safe rate limit, and fixtures—see [CONTRIBUTING.md](CONTRIBUTING.md).

Recommended candidates, chosen for broad reader reach and official/public availability rather than any individual user's bookmarks:

1. **MangaDex** — investigate its documented API before considering page scraping.
2. **WEBTOON** — a major official webcomic platform with frequent updates.
3. **MANGA Plus by SHUEISHA** — a major official manga platform.
4. **Tapas** — official English webcomics and novels platform.
5. **Tappytoon** — official Korean comics and novels catalogue.
6. **Manta** — official manhwa, manga, and novel platform.
7. **Lezhin Comics** — official webtoon platform.
8. **Toomics** — official webtoon platform.
9. **Comikey** — official manga and webtoon platform.
10. **Pocket Comics** — official webtoon and manga platform.
11. **Naver WEBTOON Korea** — a major Korean webtoon catalogue; assess localization and access constraints first.

Some sources have dynamic pages, authentication, anti-bot controls, paid chapters, or terms that prohibit automated access. Those sources should not be added until there is a compliant way to retrieve public update metadata.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## Privacy and limitations

- Libraries are tied to a browser cookie. Clearing site data or changing browsers removes access to that anonymous library.
- The app tracks public chapter metadata; it does not host or distribute comic content.
- A successful import means links were saved. A source may still fail a later check if its public page changes or is unavailable.
