# Batch 76 validation: upstream PRs #877–884, issue #885, and PR #886

Batch 76 reviewed the full descriptions and current conversations, review
threads, changed files, and checks for all ten upstream records. Their source
digests match the refreshed snapshot at upstream `main`
`0b538fe4b0a2269edcc8fd3e71e2bbc240291868`. The fork already contains the
actionable behavior from these requests; no application source changes were
needed in this batch. The per-item findings and evidence are in the
[campaign ledger](../ledger.json).

## Upstream dispositions and fork behavior

- [PR #877](https://github.com/Doezer/Questarr/pull/877) was closed as a
  duplicate after the equivalent default-off `sortExtras` feature landed in
  #891. Its distinct batch `modeUsed` correction was carried forward in #931.
  QuestarrNG has the setting, categorized import placement, confirmation-time
  reclassification, duplicate-destination and path-containment checks, and
  regression coverage. The PR's review threads are resolved.
- [PR #878](https://github.com/Doezer/Questarr/pull/878) fixes the Alpine
  better-sqlite3 install failure. The lock now resolves 13.0.3, and a clean
  production Buildx build completed from the pinned Node 26 Alpine image. One
  remaining CodeRabbit note recommending exact build-tool pins is outdated and
  non-blocking; the pinned image uses its versioned Alpine repository, and the
  clean build passed with the repository's current patched toolchain.
- [PR #879](https://github.com/Doezer/Questarr/pull/879) requests undici 8.9.0
  and aligns the Node support floor. QuestarrNG locks 8.11.2, declares Node
  `>=22.19.0`, tests that floor and Node 26 in CI, and documents the major
  version change and security assessment.
- [PR #880](https://github.com/Doezer/Questarr/pull/880) is reflected in the
  deploy workflow: the `push` trigger is absent, the scheduled run selects
  `dev`, and manual environment selection remains available.
- [PRs #881](https://github.com/Doezer/Questarr/pull/881),
  [#882](https://github.com/Doezer/Questarr/pull/882), and
  [#883](https://github.com/Doezer/Questarr/pull/883) are superseded by the
  current lock: postcss 8.5.29, brace-expansion 5.0.12, fast-uri 3.1.8, and
  ip-address 10.7.2 meet or exceed their requested targets.
- [PR #884](https://github.com/Doezer/Questarr/pull/884) was explicitly
  closed by its maintainer as a one-time cleanup request, not a permanent
  nightly retention change. The existing 15-day policy remains; no persistent
  same-day deletion rule was introduced.
- [Issue #885](https://github.com/Doezer/Questarr/issues/885) has a concrete
  qBittorrent single-file path fix: the issue reporter found that the torrent
  display name can differ from the actual filename. The import resolver now
  uses the client-reported file path and the cron and pending-import paths both
  use that resolver. Regression tests cover mismatched names, missing metadata,
  and multi-file paths.
- [PR #886](https://github.com/Doezer/Questarr/pull/886) is covered by the
  Unraid template's 99:100 PUID/PGID defaults, `UMASK=022`, and
  `--user=99:100` runtime argument. The entrypoint applies UMASK before it
  executes the app; the general image default remains 1000:1000.

## Validation

- Focused tests across the import settings, storage, import strategies, import
  manager, downloader path, and cron suites: **291 passed across 7 files**.
- `npm run check`: passed.
- better-sqlite3 in-memory create/insert/read smoke: passed. The locked package
  includes the Linux musl prebuild.
- A clean isolated Buildx build of the production image for `linux/amd64`:
  passed through Alpine package installation, `npm ci`, Vite and TypeScript
  compilation, production dependency pruning, and OCI export. The install and
  prune reported zero npm vulnerabilities. Vite printed its existing advisory
  for chunks larger than 500 kB.
- Parsed `.github/workflows/deploy.yml` and verified the only deploy triggers
  are `workflow_dispatch` and `schedule`, with the manual environment input
  preserved.
- `sh -n entrypoint.sh`, Unraid XML parsing, and checks for the 99:100 IDs,
  UMASK default, and `--user=99:100`: passed.
- No `client/src/**` file changed in this batch.

The build context and OCI image were stored under a unique scratch directory
on kspls0's LVM-backed `/mnt/datapool_lvm_media` share. The isolated Buildx
builder and scratch directory were removed after the build, and the path was
confirmed absent. The desktop NFS mount was not used. Batch 76 is documentation
and ledger work only; the campaign remains incomplete and must not be merged
to `main`.
