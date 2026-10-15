# GitHub Copilot Instructions for QuestarrNG

## Project overview

QuestarrNG is a self-hosted game discovery, library, and download manager. It supports SQLite and PostgreSQL, connects to configurable torrent and Usenet clients and indexers, and can integrate with SeerrNG. Keep existing user data, authentication, encrypted credentials, and both database dialects working when changing shared behavior.

## Current stack

- Client: React 19, TypeScript, Vite 8, Tailwind CSS 4, Radix/shadcn UI, Wouter, and TanStack Query.
- Server: Node.js `>=22.19` (CI and Docker use Node 26), TypeScript ES modules, Express 5, Socket.IO, and Pino.
- Data: Drizzle ORM with SQLite and PostgreSQL. Shared models and API types live in `shared/schema.ts`; PostgreSQL-specific table definitions are in `shared/schema.pg.ts`. SQLite and PostgreSQL migrations are maintained separately in `migrations/` and `migrations-pg/`.
- Validation: Zod schemas and the request validators in `server/middleware.ts`.
- Tests: Vitest for unit/integration tests and Playwright for browser tests.

## Code map

- `client/src/pages/` contains route pages; `client/src/components/`, `hooks/`, and `lib/` contain reusable UI, hooks, and client utilities.
- `server/index.ts` starts the app. `server/app.ts`, `server/routes.ts`, and `server/routes/` compose HTTP behavior; domain modules under `server/` hold auth, config, storage, downloaders, search, migrations, security, and integrations.
- `server/storage.ts` is the persistence boundary. Keep SQL and dialect-specific differences behind the existing database/storage helpers.
- `shared/` contains types, schemas, and utilities used on both sides. Reuse shared types instead of creating client-only duplicates.
- `server/__tests__/`, `client/__tests__/`, and `tests/e2e/` contain server, client, and browser coverage.

## Working conventions

- Follow nearby patterns and keep TypeScript strict. Avoid `any`; validate untrusted input at the API boundary.
- Read secrets and environment settings through `server/config.ts`. Do not log credentials, tokens, or secret values.
- Use the existing credential-encryption helpers for stored indexer and downloader secrets.
- For outbound requests to user-configured or otherwise untrusted URLs, use the SSRF-safe helpers in `server/ssrf.ts` and preserve redirect validation.
- Keep API failures in the existing structured error format and let the shared Express error middleware handle thrown route errors.
- Add or update tests for changed behavior. Schema changes need the appropriate SQLite and PostgreSQL migrations and parity checks.
- Keep UI changes responsive and consistent with the existing theme and component library.

## Development and validation

```bash
npm ci
npm run dev
npm run dev:test
npm run check
npm run lint
npm run format:check
npm run test:run
npm run test:e2e
npm run build
npm run db:check:pg
```

`npm run dev:test` uses the test database and port 5100. Do not point tests at a user's production database. For a change under `client/src/**`, run the UI with `npm run dev:test`, exercise the affected page in a browser, capture a screenshot or short recording, and include that evidence in the PR description.

Use the dialect-specific migration scripts and existing database guidance rather than applying a SQLite-only change to PostgreSQL. Run the focused test first, then the relevant full checks for the affected area.

## Repository tools

Follow any applicable `AGENTS.md` command instructions. When it requires RTK, prefix each shell command with `rtk`. If generated `graphify-out/graph.json` exists and an architecture question needs it, use `graphify query`, `graphify path`, or `graphify explain` before reading a broad source tree.

Use short commit messages that describe the change in plain language and reference upstream issue or PR numbers when useful.
