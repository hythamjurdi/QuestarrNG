# Batch 78 validation — October 14, 2026

## Source review

The ledger and inventory were regenerated from the live GitHub audit against upstream main `0b538fe4b0a2269edcc8fd3e71e2bbc240291868`; the ledger's `capturedAt` generation timestamp is `2026-10-14T02:09:51.557Z`. The sanitized inventory contained 232 issues and 931 pull requests. Batch 78 reviewed each PR's body, comments, review threads, patch, changed files, and available workflow results. All eleven records matched their refreshed source digests.

| PR                                                  | Disposition                                | Finding                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#897](https://github.com/Doezer/Questarr/pull/897) | Verified                                   | IGDB search supports platform and year filters, caps results at ten, validates year bounds, clears stale results for incomplete years, and disables undated-first when a year is selected. The UI, route validation, and regression coverage are present. |
| [#898](https://github.com/Doezer/Questarr/pull/898) | Superseded by #1048                        | The draft was closed in favor of #1048, which carries the target-platform request. Persist/change/clear and auto-search behavior are covered in the fork.                                                                                                 |
| [#899](https://github.com/Doezer/Questarr/pull/899) | Verified                                   | Requested development dependency versions are already present or exceeded; `@types/semver` remains at the requested 7.8.0.                                                                                                                                |
| [#900](https://github.com/Doezer/Questarr/pull/900) | Superseded                                 | All eight requested production dependency updates are already exceeded by the current lockfile.                                                                                                                                                           |
| [#901](https://github.com/Doezer/Questarr/pull/901) | Superseded                                 | The three requested workflow action pins are already newer in the current workflows.                                                                                                                                                                      |
| [#902](https://github.com/Doezer/Questarr/pull/902) | Superseded by #905                         | The initial ARM proposal was replaced by #905. The final workflow uses one shared multi-architecture predicate for QEMU and Buildx, and the support wording scopes the claim to Docker images.                                                            |
| [#903](https://github.com/Doezer/Questarr/pull/903) | Superseded by the patched-release approach | The maintainer closed the proposed SCA bypass after choosing a v1.4.2 hotfix with patched dependencies. QuestarrNG retains its strict gate: unresolved Critical/High findings block release, with no bypass reason or environment override.               |
| [#904](https://github.com/Doezer/Questarr/pull/904) | Verified                                   | The v1.4.3 version stream avoids collision with the v1.4.2 hotfix tag. Current application, Docker, and add-on metadata consistently use QuestarrNG 1.10.0, and the changelog preserves the security-hotfix history.                                      |
| [#905](https://github.com/Doezer/Questarr/pull/905) | Verified                                   | The merged multi-architecture workflow and Docker support are present. Batch 77 built, ran, and extracted real RAR5 fixtures from both amd64 and arm64 production images.                                                                                 |
| [#907](https://github.com/Doezer/Questarr/pull/907) | Superseded by #908                         | The standalone performance proposal was consolidated into the merged #908 change.                                                                                                                                                                         |
| [#908](https://github.com/Doezer/Questarr/pull/908) | Verified                                   | Library genre/platform options are collected in one traversal and deduplicated and sorted; a regression test covers duplicate values and ordering.                                                                                                        |

The review used the GitHub source records for PR descriptions, conversation and review threads, patches, changed files, and checks. PR #897's historical head run returned `startup_failure`; the dependency PRs #899–901 had successful upstream checks. The current fork was validated locally as described below. PR #905's ARM runtime behavior is backed by the production-image results in [Batch 77 evidence](validation-batch-77.md).

## Regression and browser validation

The existing implementation was already in place; this batch adds regression checks for gaps in its evidence:

- Search route tests accept boundary years 1950 and 2100 and reject platform `0`, fractional platform `1.5`, years 1949 and 2101, and nonnumeric years with HTTP 400 before calling IGDB.
- The Add Game browser journey selects PlayStation 2 and 2005 for God of War, verifies the request includes `limit=10`, `platform=8`, and `year=2005`, and confirms undated-first is disabled while a year is selected. The running UI screenshot is [`upstream-pr-897-add-game-filters-2026-10-14.png`](upstream-pr-897-add-game-filters-2026-10-14.png).
- A real in-memory SQLite integration test persists the target-platform pair, changes it, and clears it to `null`.
- Library filter tests verify that duplicate genre and platform values appear only once and remain alphabetically sorted.

Focused test command:

```sh
npx vitest run --pool=forks --maxWorkers=1 \
  client/__tests__/AddGameModal.test.tsx \
  client/__tests__/GameDetailsModal.test.tsx \
  client/__tests__/Library.defaultFilters.test.tsx \
  client/__tests__/Library.mobile.test.tsx \
  client/__tests__/Library.platform-filter.test.tsx \
  shared/__tests__/schema.test.ts \
  shared/__tests__/title_utils.test.ts \
  server/__tests__/api_routes.test.ts \
  server/__tests__/cron_autosearch.test.ts \
  server/__tests__/igdb.test.ts \
  server/__tests__/integration_api.test.ts \
  server/__tests__/storage.test.ts \
  server/__tests__/database_storage_integration.test.ts
```

Result: 13 test files passed, 869 tests passed, and none were skipped.

## Repository checks

The following checks passed:

- `npm run check` (TypeScript)
- `npm run lint`
- `npm run format:check`
- `npm run secretlint`
- `npm run check:overrides`
- `npm run check:licenses` (417 production package versions allowed)
- `npm run build` (Vite and TypeScript)
- Deployment workflow YAML parsing and five-case matrix checks for production, development, and test builds; QEMU and Buildx both use the shared architecture decision.
- Dependency and version assertions for PRs #899–901 and #904, and a strict-SCA-policy assertion that no bypass input or bypass condition was added.

Vite emitted the existing non-fatal large-chunk advisory. No application source under `client/src/**` changed in this batch; the live screenshot supplements the regression tests for the existing UI.

## Scratch cleanup

The headless browser used `npm run dev:test` with a disposable test account and mocked API responses. Its local `data/test.db`, WAL, and SHM files were removed after the server stopped and their absence was checked. The screenshot is intentionally retained as evidence. Existing ignored `dist/` output was preserved because its modification time predated this batch's build. The LVM NFS mount probe stalled in the kernel, so no NFS scratch files were created; the probe process started for this batch was killed and verified gone. No other NFS processes or ambiguous files were modified.
