# Batch 77 validation — October 14, 2026

Batch 77 reviewed upstream PRs #887–895 and issue #896. The refreshed source
snapshot is upstream main `0b538fe4b0a2269edcc8fd3e71e2bbc240291868`, captured
at `2026-10-14T01:44:16.005Z`. All ten records were unchanged from their source
snapshots. The only inventory item flagged as source-changed remains PR #1194.

| Record                                                      | Disposition                          | Finding                                                                                                                               |
| ----------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| PR [#887](https://github.com/Doezer/Questarr/pull/887)      | Superseded by #890                   | The merged combined PR includes the sidebar badge optimization; component tests pass.                                                 |
| PR [#888](https://github.com/Doezer/Questarr/pull/888)      | Superseded by #890                   | The combined PR uses shared accessible tooltips in the RSS list; component tests pass.                                                |
| PR [#889](https://github.com/Doezer/Questarr/pull/889)      | Superseded by #890                   | The combined PR migrates downloader HTTP requests to `safeFetch`; SSRF and redirect tests pass.                                       |
| PR [#890](https://github.com/Doezer/Questarr/pull/890)      | Verified                             | Combined sidebar, tooltip, and downloader-safety behavior is present; reviewed redirect and credential handling are covered.          |
| PR [#891](https://github.com/Doezer/Questarr/pull/891)      | Verified                             | Game-file persistence and authenticated content APIs include ownership and path checks with storage and route tests.                  |
| PR [#892](https://github.com/Doezer/Questarr/pull/892)      | Superseded by #938; hardened by #944 | The rebased scan feature is read-only and bounded, with root containment and category normalization.                                  |
| PR [#893](https://github.com/Doezer/Questarr/pull/893)      | Superseded by #945                   | The Files tab supports loading, error, empty, flat, and grouped states and is hidden for discovery-only games.                        |
| PR [#894](https://github.com/Doezer/Questarr/pull/894)      | Superseded                           | Every requested development-dependency target has been exceeded by the current package and lockfile versions.                         |
| PR [#895](https://github.com/Doezer/Questarr/pull/895)      | Verified                             | `safeUrl` guards both indexer-comments link render points; the unsafe-scheme regression test passes.                                  |
| Issue [#896](https://github.com/Doezer/Questarr/issues/896) | Verified                             | The Docker image now builds native UnRAR for each target architecture; both images extract real RAR5 fixtures and start successfully. |

For #894, the current lockfile versions exceed the requested targets: `@playwright/test` 1.63.0; the Secretlint preset and `secretlint` 13.0.7; `@vitejs/plugin-react` 6.1.2; `lint-staged` 17.6.0; `postcss` 8.5.29; and `prettier` 3.9.9.

## Changes

The upstream ARM issue was closed after its maintainer restored ARM64 builds in
release 1.4.2. QuestarrNG's workflows already built ARM64 images, but its
Dockerfile still installed an x64-only UnRAR executable, so RAR extraction did
not work in the ARM64 image. The Dockerfile now builds UnRAR from RARLAB's
source archive for the target platform, checks the archive's SHA-256, verifies
that the resulting executable reports version 7.23, and copies the required
license to `/usr/share/licenses/questarr/UNRAR-LICENSE.txt`. The supported
architecture and archive behavior are documented in the root README,
`docs/LIBRARY_IMPORT.md`, and `docs/SECRETS.md`; a release note records the user
impact.

The Files tab was exercised in the running application using `npm run dev:test`
and a headless Playwright browser. The browser used a disposable test account
and intercepted game and file API responses, then opened the Files tab and
verified main-game and DLC groups. The captured visual evidence is
[`upstream-pr-893-files-tab-2026-10-14.png`](upstream-pr-893-files-tab-2026-10-14.png).

## Validation results

- Focused Vitest command:

  ```sh
  npx vitest run --pool=forks --maxWorkers=1 \
    client/__tests__/AppSidebar.test.tsx \
    client/__tests__/RssFeedList.test.tsx \
    client/__tests__/GameDetailsModal.test.tsx \
    client/__tests__/GameDownloadDialog.test.tsx \
    server/__tests__/downloaders_ssrf.test.ts \
    server/__tests__/ssrf.test.ts \
    server/__tests__/game_files_routes.test.ts \
    server/__tests__/storage.test.ts
  ```

  Result: 8 files passed; 281 tests passed and 1 was skipped.

- `npm run check` (TypeScript), `npm run lint`, `npm run format:check`,
  `npm run secretlint`, `npm run check:overrides`, and `npm run check:licenses`
  passed. The license check allowed all 417 production package versions.
- Clean `linux/amd64` and `linux/arm64` production images built with Buildx and
  `--no-cache`. Both `npm ci` and production pruning reported 0 npm
  vulnerabilities; the Vite and TypeScript builds passed for both targets.
  Vite emitted its existing large-chunk advisory.
- The loaded images reported the expected `amd64` and `arm64` architectures,
  returned UnRAR 7.23 from `unrar -iver`, and contained the UnRAR license file.
  On both architectures, `unrar t` and extraction passed for a RAR5
  single-file archive and a 12-volume RAR5 set. Extracted `hello.txt` and
  `payload.bin` matched their expected inputs byte-for-byte.
- The amd64 and arm64 app containers both started and returned
  `{"status":"ok"}` from `/api/health`. The first arm64 health probe used a
  60-second window and expired while Node was starting under QEMU; the container
  remained alive and the same smoke passed on a longer bounded retry. Node 26
  and the `better-sqlite3` module were also loaded independently in the arm64
  image.
- `git diff --check` passed. After the implementation commit, the release-note
  check exited successfully with `origin/main` as the base and validated 49
  user-facing fragments. It printed non-failing diagnostics for unrelated
  release-note files absent from the historical `v1.5.0` tag.

## Scratch cleanup

The desktop host was `kspld0`; the scratch server was `kspls0`, and the
LVM-backed share was confirmed at `/mnt/datapool_lvm_media` with 242 TB total and
31 TB free before work began. Build context, RAR source, and test archives were
stored only in `/mnt/datapool_lvm_media/questarrng-b77.6qfJAJ`. After the
checks, both `questarr-b77:amd64` and `questarr-b77:arm64` image tags, the
isolated `questarr-b77-6qfJAJ` Buildx builder, and the full task scratch
directory were removed and verified absent. The task-owned dev server was
stopped, and its disposable `data/test.db`, WAL, and SHM files were removed.
The screenshot is retained as review evidence; no pre-existing data or shared
Docker images were removed.
