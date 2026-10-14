# Batch 81 validation — October 14, 2026

## Source review

The inventory was refreshed from GitHub at upstream main
`0b538fe4b0a2269edcc8fd3e71e2bbc240291868`. The ledger captured the sanitized
1,163-item snapshot at `2026-10-14T02:57:47.686Z`. PRs #926–#933 were reviewed
against their descriptions, commits, changed files, review discussions, and
available checks. The linked requests for #926, #931, and #932 were checked as
well. All eight PR source digests matched the refreshed snapshot.

| Source | Disposition | Finding |
| --- | --- | --- |
| [PR #926](https://github.com/Doezer/Questarr/pull/926) | Verified | qBittorrent 5.2+ JSON success and error responses are handled correctly for torrent-file uploads, with regression coverage for each outcome. |
| [PR #927](https://github.com/Doezer/Questarr/pull/927) | Verified | Downloader response diagnostics are opt-in, bounded, and scrubbed; the implementation covers failed and authentication responses and validates the logging API contract. The review discussion's privacy and stability concerns were checked. |
| [PR #928](https://github.com/Doezer/Questarr/pull/928) | Verified | The logs API defaults to 1,000 entries and caps history at 5,000; the Logs page requests the larger history while the mobile display cap remains. |
| [PR #929](https://github.com/Doezer/Questarr/pull/929) | Verified | The follow-up fixes for #927 are present in the bounded, default-off, scrubbed response-logging implementation; the upstream checks passed. |
| [PR #930](https://github.com/Doezer/Questarr/pull/930) | Verified | SendErrorReportDialog passes the issue number required by the GitHub issue URL helper; client type-checking and dialog tests pass. |
| [PR #931](https://github.com/Doezer/Questarr/pull/931) | Verified | PC import results preserve the batch's requested transfer mode while recording individual-file fallback separately. Tests check the mode and file identity. |
| [PR #932](https://github.com/Doezer/Questarr/pull/932) | Verified | The three import/download fixes are present: owner-scoped game relinking with conditional updates, duplicate or missing mapped-path handling for manual NZBGet/SAB imports, and NZBGet completed-history DestDir lookup. |
| [PR #933](https://github.com/Doezer/Questarr/pull/933) | Implemented, unverified | The fork contains an opt-in Windows installer workflow and .NET 10 service wrapper. The service project compiled, but the Inno Setup installer has not been compiled or installed on Windows, so the item remains open for verification. |

The PR #932 port keeps the source behavior compatible with QuestarrNG's
multi-user model: a download can only be linked to a game owned by the active
user, and conditional transitions avoid overwriting a concurrent change.

## Regression validation

The focused suite covered the qBittorrent upload response, downloader
diagnostics, logs API and UI, error-report dialog, import transfer behavior,
owner-scoped game linking, manual-import paths, and NZBGet history lookup:

```sh
npx vitest run --pool=forks --maxWorkers=1 \
  server/__tests__/downloaders_qbittorrent_regression.test.ts \
  server/__tests__/qbittorrent_features.test.ts \
  server/__tests__/downloaders_qbittorrent_remaining.test.ts \
  server/__tests__/downloaders_debug_logging.test.ts \
  server/__tests__/api_routes_extended.test.ts \
  server/__tests__/api_routes.test.ts \
  client/__tests__/LogsPage.test.tsx \
  client/__tests__/LogsPage.remaining.test.tsx \
  client/__tests__/SendErrorReportDialog.test.tsx \
  server/__tests__/import_strategies.test.ts \
  server/__tests__/import_manager.test.ts \
  server/__tests__/import_routes_additional.test.ts \
  server/__tests__/import_routes_coverage.test.ts \
  server/__tests__/database_storage_extended.test.ts \
  server/__tests__/downloaders_nzbget_remaining.test.ts \
  server/__tests__/downloaders_utils_manager.test.ts \
  client/__tests__/PendingImportsCard.test.tsx \
  client/__tests__/LinkGameModal.test.tsx
```

Result: 18 test files passed, 829 tests passed, and none were skipped.

The following repository checks passed:

- `npm run check` (TypeScript)
- `npm run lint`
- `npm run format:check`
- `npm run secretlint`
- `git diff --check`

The self-contained Windows service compiled successfully with zero warnings
and errors:

```sh
dotnet build installer/windows/Questarr.Service/Questarr.Service.csproj \
  --configuration Release --runtime win-x64 --self-contained true \
  -p:EnableWindowsTargeting=true --artifacts-path /tmp/questarr-b81-dotnet
```

That validates the service project only. The Inno Setup compiler attempt used
an isolated Wine prefix, but Wine initialization hung. The attempt was stopped
and its temporary prefix removed. All 17 available recent deploy-workflow runs
were inspected; every `windows-installer` job was skipped. Dispatching the
workflow to force this optional job would also execute its Docker deployment
path, so no such run was started. PR #933 therefore remains
`implemented-unverified` until the installer artifact and checksum are built
and its Windows install/service lifecycle are verified.

No application source files changed in this batch, so the production build was
not repeated. No `client/src/**` files changed, so no new running-UI screenshot
was required. No real downloader credentials or services were used.

## Scratch cleanup

The temporary .NET artifacts and isolated Wine prefix were removed after
validation. No NFS scratch or browser server was used. The pre-existing `dist/`
directory and the unrelated checkout on the main workspace branch were left
untouched. No process on port 5100 was stopped. The campaign branch remains
`codex/upstream-resolution`; it has not been merged to `main`.
