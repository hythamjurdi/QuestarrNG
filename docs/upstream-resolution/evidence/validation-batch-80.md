# Batch 80 validation — October 14, 2026

## Source review

The inventory was refreshed from GitHub after fetching upstream main at
`0b538fe4b0a2269edcc8fd3e71e2bbc240291868`. The sanitized ledger was generated
at `2026-10-14T02:38:16.016Z`. Batch 80 reviewed PR descriptions, dependency
tables or action diffs, commits, changed files, review comments, and available
checks. Issue #925's comments and timeline were also inspected. All eight
records matched their refreshed source digests.

| Source                                                      | Disposition | Source request and current fork behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PR #917](https://github.com/Doezer/Questarr/pull/917)      | Verified    | All seven development-dependency targets are present or exceeded: `@testing-library/jest-dom` 7.0.1 (target 7.0.1), `@types/node` 26.6.4 (26.2.0), `@types/three` 0.186.0 (0.185.4), `esbuild` 0.28.2 (0.28.2), `postcss` 8.5.29 (8.5.26), `typescript-eslint` 8.71.1 (8.67.0), and `vite` 8.3.2 (8.2.1). Upstream's CI, dependency review, SAST, deprecated-dependency, and build checks passed.                                                                                                                                                                                                                                                                                                                                                             |
| [PR #918](https://github.com/Doezer/Questarr/pull/918)      | Superseded  | The PR updates Harden Runner to v2.20.1 and CodeQL `upload-sarif` to v4.37.6. QuestarrNG pins newer immutable SHAs for v2.22.0 and v4.38.2. Upstream checks passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [PR #919](https://github.com/Doezer/Questarr/pull/919)      | Superseded  | All nine production targets are exceeded: `better-sqlite3` 13.0.3 (target 13.0.3), `express-rate-limit` 8.7.0 (8.6.2), `lucide-react` 1.52.0 (1.31.0), `nanoid` 6.0.2 (6.0.1), `pg` 8.23.1 (8.23.0), `@types/pg` 8.23.1 (8.21.0), `react-hook-form` 7.89.0 (7.85.0), `tsx` 4.23.15 (4.23.12), and `undici` 8.11.2 (8.10.0). Upstream checks passed.                                                                                                                                                                                                                                                                                                                                                                                                           |
| [PR #920](https://github.com/Doezer/Questarr/pull/920)      | Superseded  | This closed ESLint update targets 10.8.1 and its upstream CI checks fail. QuestarrNG already uses ESLint 10.12.0; its current typecheck and lint pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [PR #921](https://github.com/Doezer/Questarr/pull/921)      | Superseded  | The requested Framer Motion 13.0.0 is exceeded by QuestarrNG's 14.0.0. The merged upstream checks passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [PR #922](https://github.com/Doezer/Questarr/pull/922)      | Verified    | `@types/parse-torrent` 11.0.1 is present at the requested version. Current typechecking passes; upstream CI, dependency review, SAST, and builds passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [PR #924](https://github.com/Doezer/Questarr/pull/924)      | Verified    | QuestarrNG has opt-in error telemetry (off by default), a consent prompt, PII-scrubbed diagnostic content, one automatic submission per detected error, cooldown and report TTL, owner checks, UUID validation, retryable idempotent sends, and bounded fatal handling. Transient metadata failures offer retry; only 404 means expired. The report reviewed 32 inline comments, including ownership, log privacy, duplicate sends, failure handling, and notification delivery. The upstream proposal to decouple Apprise from in-app notification preferences was withdrawn by the author because it contradicted the project's existing notification behavior. QuestarrNG later added per-user socket rooms, so notifications no longer leak across users. |
| [Issue #925](https://github.com/Doezer/Questarr/issues/925) | Verified    | Add Game sends `/api/igdb/search` through the base-path-aware `apiFetch` wrapper. Client coverage checks `/Questarr/api/igdb/search`, and the server route test verifies that the prefixed path works while the unprefixed path returns 404.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Regression validation

The focused suite covered telemetry settings and consent behavior, report
ownership and delivery, error scrubbing, the base-path-aware client and server
route, and existing support-log handling:

```sh
npx vitest run --pool=forks --maxWorkers=1 \
  server/__tests__/error_telemetry.test.ts \
  server/__tests__/security_error_handling.test.ts \
  server/__tests__/api_routes.test.ts \
  shared/__tests__/log-scrub.test.ts \
  client/__tests__/queryClient-base-path.test.ts \
  client/__tests__/app-path.test.ts \
  client/__tests__/SettingsPage.test.tsx \
  client/__tests__/SendErrorReportDialog.test.tsx \
  client/__tests__/send-logs.test.ts
```

Result: nine test files passed, 495 tests passed, and none were skipped. New
client tests verify that automatic telemetry is off by default, saving opt-in
persists the preference, sending waits for explicit consent, 404 alone produces
the expired state, and transient metadata failures can be retried.

The following checks passed:

- `npm run check` (TypeScript)
- `npm run lint`
- `npm run format:check`
- `npm run secretlint`
- `git diff --check`

No production source or dependency files changed, so the production build was
not repeated; the current build had passed in Batch 79. No `client/src/**`
files changed, so no new visual evidence was required for Batch 80.

## Cleanup

The tests used their isolated test environments and left no task scratch files.
No NFS scratch or browser server was used in this batch. The branch remains on
`codex/upstream-resolution`; there is no campaign merge into `main`.
