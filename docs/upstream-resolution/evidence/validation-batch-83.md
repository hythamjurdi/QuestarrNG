# Batch 83 validation — October 14, 2026

Batch 83 reviewed PRs #942–#943, issue #944, and PRs #945–#949. All eight
records matched the refreshed upstream source snapshot. Seven are verified;
PR #947 is superseded by QuestarrNG’s stricter policy of always validating
SABnzbd TLS certificates.

The live snapshot was generated at `2026-10-14T03:37:49.100Z` against upstream
main `0b538fe4b0a2269edcc8fd3e71e2bbc240291868`. The fork head recorded at
review time was `5cbe8be45726100c43a81d1ec852ada56404f0e8`.

## Review and implementation

- PR #942: verified; every CI and Docker `npm ci` invocation uses
  `--ignore-scripts`.
- PR #943: verified; root-folder discovery, server validation and probes,
  scanning, opt-in deletion, UI, documentation, and regression coverage are
  present. The implementation follows the project’s shared instance-admin
  configuration model.
- Issue #944: verified; the endpoint stops at 5,000 files, 8 MiB of encoded
  response data, depth 128, or 5 seconds, and reports `truncated: true` when a
  limit stops the scan. Async directory iteration avoids materializing a
  whole directory before limits apply. The endpoint remains limited to ten
  requests per minute per authenticated user. The Files tab now announces
  partial results while showing the files returned. `docs/API.md` and
  `docs/THREAT_MODEL.md` describe the response and resource limits.
- PR #945: verified; the Files tab has the shared scan-result contract and
  covers loading, error, empty, flat, and grouped results.
- PR #946: verified; Discord webhook settings live on Stats, with save, clear,
  hide/show, and legacy alias behavior covered by tests.
- PR #947: superseded; QuestarrNG never disables TLS certificate verification.
  Private CAs can be trusted with the operating system/container trust store
  or `NODE_EXTRA_CA_CERTS`; the legacy database field cannot bypass checks.
- PR #948: verified; xREL requests have a 24-second timeout, and nuke reasons
  and flags are rendered as visible release text and badges. Upstream’s
  SonarCloud Code Analysis quality gate failed because new-code duplication
  was 18.4% against a 3% maximum. Its other reported CI, security, build, and
  test checks succeeded; the focused fork tests pass.
- PR #949: verified; Settings are grouped into seven domain tabs, blacklist
  removal is accessible and game-scoped, and the IGDB per-user rate limit is
  clamped and server-validated from 1 through 4.

The Batch 82 record for PR #935 has also been corrected: the legacy
`allowSelfSignedCertificate` value does not enable a retry with certificate
validation disabled. Commit `d822e19d18156deff757ff10bd208b48f5d564f6` removed
that fallback, and current code, tests, UI copy, and compatibility guidance
confirm strict verification. This corrects the stale statement that the
fallback remained an active opt-in.

## Automated validation

Focused Vitest validation passed **628 tests across 15 files**, with no skipped
tests. Coverage included scan count, time, response-size and depth limits,
per-user rate limiting, root-folder discovery, the Files tab, SABnzbd TLS,
xREL, settings, and Stats behavior.

The following checks passed after implementation and documentation updates:

- `npm run check`
- `npm run lint`
- `npm run format:check`
- `npm run secretlint`
- `npm run build` (completed with the existing large-chunk advisory)
- `git diff --check`

Because `client/src/components/GameDetailsModal.tsx` changed, the Files tab was
also replayed in Chromium at 1280×900 against the running development app. The
test port 5100 was occupied by an unrelated process, so it was left untouched;
the app ran on port 5101 with an isolated SQLite database. A test game was
seeded, and only its files endpoint was intercepted to return a deterministic
partial result. The screenshot shows both the accessible notice and the file
entry: [scan-limits-partial-files-tab.png](scan-limits-partial-files-tab.png).
Server-side behavior was verified separately by the Vitest route and limiter
tests.

## Scratch and cleanup

The initial `npm run dev:test` attempt stopped at `EADDRINUSE` on port 5100. Its
task-created `data/test.db` was removed. The visual replay used a unique local
`/var/tmp` directory for its SQLite database and auth-file backup; the server
was stopped, the database and scratch directory were removed, and the existing
`playwright/.auth/user.json` was confirmed unchanged. The pre-existing `dist/`
directory was restored after the build. The application’s automatic startup
checks attempted the normal GitHub version and RSS lookups; the GitHub version
check returned 403 due to rate limiting. The visual replay and feature tests do
not depend on those services. No NFS scratch was used, and the process already
owning port 5100 was left untouched.
