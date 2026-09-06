# Manhwa/Manga Bookmark Tracker

A website that imports your manga/manhwa bookmarks from a browser export, tracks the latest chapter for each series, and pops up a notification when a new chapter drops — no account required.

## How it works

1. **Import** — Export your browser bookmarks as an HTML file and upload it. The backend parses the file, matches each bookmarked URL against a set of known site adapters, and extracts a site + series slug for each recognized bookmark.
2. **Track** — Each bookmark is stored with its last-known chapter number.
3. **Check** — When you open the site, the backend fetches the current chapter for each tracked series directly from the source site (on-demand, not via background cron).
4. **Notify** — If the fetched chapter number is greater than what's stored, a popup surfaces the update. The stored chapter is updated once you've seen/read it.
5. **No login** — You're identified by a signed, HTTP-only JWT stored in a cookie, issued automatically on first visit. No email, no password, no account creation.

## Supported sites (v1)

Adapters exist for a fixed set of known manga/manhwa sites (site-specific URL parsing + chapter scraping per site, rather than a generic scraper). Currently includes both licensed platforms (WEBTOON, MangaDex, Manga Plus, Tapas, Viz, Bilibili Manga) and scanlation aggregators (Asura Scans, Mangakakalot).

> **Note:** Scanlation aggregator domains change frequently (Asura Scans alone has migrated domains 10+ times historically). Site configs are designed to be updatable without a full redeploy — see [Site Adapters](#site-adapters) below.

## Tech stack

- **Backend:** NestJS, Prisma ORM, SQLite
- **Auth:** Anonymous sessions via signed JWT in an HTTP-only cookie (`GuestAuthGuard`), no user accounts
- **Bookmark parsing:** `cheerio` (parses the standard Netscape Bookmark HTML format used by all major browser exports)
- **File upload:** `@nestjs/platform-express` + `multer` (in-memory, no disk writes)
- **Validation:** Zod

## Project structure

```
src/
├── auth/
│   ├── guards/
│   │   └── guest-auth.guard.ts      # issues/verifies the anonymous session cookie
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   └── types/
│       └── guest-payload.type.ts    # Zod schema + type for the JWT payload
├── bookmarks/
│   ├── bookmark.controller.ts       # POST /bookmarks/import
│   ├── bookmark.service.ts          # HTML parsing + DB upsert
│   └── site-matchers.ts             # per-site URL → slug extraction
├── prisma/
│   ├── schema.prisma
│   └── prisma.service.ts
└── main.ts
```

## Data model

- **User** — one row per anonymous session (`id` = the `sub` claim from the JWT)
- **Bookmark** — belongs to a User; stores `url`, `site`, `slug`, `lastChapter`, `lastCheckedAt`, `isRead`

## Site adapters

Each supported site needs two things:
1. A **slug extractor** — pulls the series identifier out of a bookmarked URL (used during import)
2. A **chapter scraper** — given a slug, fetches the current latest chapter from the site

To reduce redeploys when an aggregator site migrates domains, site configs (domain, URL pattern, chapter selector) are intended to move into a DB-backed table rather than staying hardcoded, so a domain change is a data update, not a code change.

## Setup

```bash
npm install
npx prisma migrate dev
npm run start:dev
```

Environment variables (`.env`):
```
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-secret-here
NODE_ENV=development
```

## Known limitations (v1)

- Update checks are on-demand (triggered by opening the site), not scheduled — first load after a while may be slower for users with many bookmarks.
- Bookmark import requires a manual browser export; there's no live sync from the browser.
- Anonymous sessions are tied to a single browser cookie — clearing cookies or switching devices loses access to existing bookmarks.
- Scanlation aggregator adapters require ongoing maintenance as those sites change domains/layouts.