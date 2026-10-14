# Batch 79 validation — October 14, 2026

## Source review

The inventory was refreshed from the live GitHub lists after fetching
`upstream/main` at `0b538fe4b0a2269edcc8fd3e71e2bbc240291868`. The sanitized
ledger was generated at `2026-10-14T02:27:18.345Z`. Batch 79 reviewed each PR's
description, commits, diff, changed files, conversation and review threads, and
available check results; both issues' descriptions, comments, and timelines
were reviewed. All eight records matched their refreshed source digests.

| Source | Disposition | Finding |
| --- | --- | --- |
| [PR #909](https://github.com/Doezer/Questarr/pull/909) | Superseded by #911 | The replacement digest points to Debian `node:26`, which does not provide `apk` for the Dockerfile's Alpine package step. QuestarrNG keeps the matching Alpine tag and digest. Upstream CI failed for the proposed update. |
| [PR #910](https://github.com/Doezer/Questarr/pull/910) | Verified | The stale import test assertion now matches the retryable `manual_review_required` state. The behavior and assertion are covered in the fork. |
| [PR #911](https://github.com/Doezer/Questarr/pull/911) | Verified | QuestarrNG's base image already combines `node:26-alpine` with its matching digest. Clean amd64 and arm64 production builds passed in Batch 77. Upstream closed the PR after a SonarCloud rule objected to specifying both the tag and digest. |
| [PR #912](https://github.com/Doezer/Questarr/pull/912) | Verified | Support-log issues include the cross-repository reference, and the investigation skill treats issue/log text as untrusted, validates a positive issue number, and requires the private-log support code to match the public issue before use. Current-head CI, dependency review, and SAST checks passed upstream. |
| [Issue #913](https://github.com/Doezer/Questarr/issues/913) | Verified | SABnzbd's `storage` path can name either the completed folder or a file inside it. QuestarrNG resolves both forms, keeps failed confirms retryable, rejects a mapped source override that is a parent of the tracked download folder when that folder is available, and warns users about the exact source and Move behavior. |
| [Issue #914](https://github.com/Doezer/Questarr/issues/914) | Verified | The shared copy helper falls back to `document.execCommand` where the secure-context clipboard API is unavailable, and callers report failure. |
| [PR #915](https://github.com/Doezer/Questarr/pull/915) | Superseded by #937 and #940 | The closed SABnzbd proposal was followed by #937 and #940. QuestarrNG's final behavior is covered against the clarified #913 single-file/folder and retryability requirements. |
| [PR #916](https://github.com/Doezer/Questarr/pull/916) | Verified | The diagnostics work moved into #803 and has since evolved with the native UnRAR path. Corrupt or incomplete archives produce actionable retry guidance, and isolated staging prevents stale partial output from being treated as an import. |

The ledger records the source-specific findings, acceptance checks, evidence,
dependencies, and status for every item. PR #1194 remains the sole
`sourceChangedSinceReview` record in the full inventory.

The implementation, client warning, release note, regression tests, and visual
evidence are in commit `dde7c452` on `codex/upstream-resolution`.

## Regression and visual validation

The focused regression set covered import review, import confirmation, SABnzbd
path resolution, archive errors and extraction, clipboard behavior, the
download dialog, and support-log issue submission:

```sh
npx vitest run --pool=forks --maxWorkers=1 \
  client/__tests__/utils.test.ts \
  client/__tests__/GameDownloadDialog.test.tsx \
  client/__tests__/SendLogsDialog.test.tsx \
  client/__tests__/send-logs.test.ts \
  server/__tests__/downloaders_sabnzbd_remaining.test.ts \
  server/__tests__/archive_service.test.ts \
  server/__tests__/import_manager.test.ts \
  server/__tests__/import_manager_archive_extraction.test.ts \
  server/__tests__/import_manager_additional.test.ts \
  server/__tests__/import_routes_coverage.test.ts \
  server/__tests__/import_routes_security.test.ts \
  server/__tests__/import_routes_additional.test.ts
```

Result: 12 test files passed, 335 tests passed, and one test was skipped.

The required `npm run dev:test` attempt could not bind its fixed port 5100,
which was already occupied by a running Questarr process in another checkout.
That process was left untouched. The same development server was started with
a separate disposable SQLite database on port 5101. A headless browser created
a disposable account, opened the real Library page, opened the pending import,
and verified the accessible source-path warning rendered with Move selected.
The screenshot is [`upstream-issue-913-source-path-warning-2026-10-14.png`](upstream-issue-913-source-path-warning-2026-10-14.png).

The following repository checks passed:

- `npm run check` (TypeScript)
- `npm run lint`
- `npm run format:check`
- `npm run secretlint`
- `npm run check:overrides`
- `npm run check:licenses` (417 production package versions)
- `npm run build` (Vite and production TypeScript compilation)
- Release-note validation for the new import-safety fragment
- `git diff --check`

Vite emitted the existing large-chunk advisory. The production build and
override checks exited successfully.

## Scratch cleanup

The temporary SQLite databases created for the failed default-port launch and
the isolated browser run, including their WAL/SHM files, were removed after the
server stopped. The temporary release-check body file was removed. The browser
used an in-memory context, so the existing `playwright/.auth/user.json` was not
changed. The screenshot is intentionally retained as campaign evidence. No NFS
scratch was needed; the existing ignored `dist/` directory was preserved. The
unrelated process on port 5100 and ambiguous scratch files were left untouched.
