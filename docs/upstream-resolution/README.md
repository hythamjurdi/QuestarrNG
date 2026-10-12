# Upstream resolution campaign

## Objective and scope

Audit every issue and PR in Doezer/Questarr, including closed issues, merged PRs,
and closed unmerged PRs. Implement still-unresolved actionable requests in
QuestarrNG, preserving existing fork integrations. The user confirmed full
historical scope on October 12, 2026.

The target is demonstrable resolution of each underlying request. Upstream
maintainers retain control over acceptance, merging and administrative closure.
Duplicates, obsolete dependency bumps, conflicting proposals, support questions
and repository governance changes require an explicit disposition and evidence;
they are not instructions to blindly replay every historical patch.

## Inventory and status

- [Every issue and PR](inventory.md): generated navigation table.
- [Resolution ledger](ledger.json): per-item findings, acceptance checks,
  dependencies and evidence. Review status is independent of GitHub state.
- [Source snapshot](sources.json): exported issue bodies/discussion and PR bodies.
  PR reviews/diffs and complete issue timelines still require detailed collection.

Latest inventory (October 12, 2026): **232 issues** (4 open, 228 closed) and
**915 PRs** (4 open, 703 merged, 208 closed unmerged), for **1,147 items**.

Of the 703 merged PRs, 463 merge commits are ancestors of the fork snapshot,
22 are ancestors of upstream/main but not the fork, and 218 are absent from both
main histories. Release branches, squash/rebase merges, equivalent patches and
reverts require further inspection. None of these counts proves functionality.

The fork and fetched upstream/main diverge by 175 fork-only and 130 upstream-only
commits at the initial snapshot. Reconcile those changes before independently
reimplementing fixes already delivered upstream. Preserve the current validation
engine work and the fork's SeerrNG, Real-Debrid, deployment and security behavior.

## Implementation sequence

1. Establish a clean validation baseline and reconcile upstream/main in a dedicated
   branch. Group conflicts by subsystem and retain fork-specific behavior.
2. Review the seven open items and all 208 closed unmerged PRs, including comments,
   review threads and diffs. Link duplicates and later replacements.
3. Review all 228 closed issues and 703 merged PRs against the resulting code.
   Convert each outstanding requirement into a reproducible acceptance check.
4. Implement dependency-ordered batches: correctness/security and data integrity;
   search and release selection; update management; metadata providers; federation;
   remaining product, deployment, accessibility and documentation gaps.
5. Validate each batch and then the combined system. Record exact source commits,
   command results, relevant migrations and running UI evidence.
6. Refresh the upstream snapshot, review changes since collection, and produce a
   per-item completion report and upstream-ready change descriptions.

Do not mark an item resolved solely because a related commit exists, its PR was
merged, a UI control was added, or a unit test passed. Verify the requested user
journey, persistence, authorization and failure behavior where relevant. Database
changes cover SQLite and PostgreSQL. UI PRs require screenshots/recordings of
`npm run dev:test` in the PR description, as required by AGENTS.md.

## Initial open-item findings

| Item                                                                            | Required investigation / proposed treatment                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#923: update notification](https://github.com/Doezer/Questarr/issues/923)      | Maintainer comments say bell/Apprise notifications already exist and update management is in progress. Verify the actual fork behavior and thumbnail indication without duplicating notification machinery.                                                           |
| [#906: cross-server libraries](https://github.com/Doezer/Questarr/issues/906)   | This is a protocol proposal, not a completed specification for Questarr. Inspect the referenced protocol and closed PR #1083. Define identity, peer revocation, separate browse/download grants, local file boundaries and compatibility tests before implementation. |
| [#406: file-type search](https://github.com/Doezer/Questarr/issues/406)         | Verified torrent-manifest extension filtering with safe redirect handling; magnets, Usenet and unknown payloads fail closed rather than relying on release-title text.                                                                                                |
| [#336: alternative game sources](https://github.com/Doezer/Questarr/issues/336) | Verified optional Hydra-format public HTTPS catalogs, bounded schema and torrent-link checks, source attribution, and integration with aggregated search; curated catalog origin is not proof of malware safety.                                                      |
| [#1172: v1.5 release preparation](https://github.com/Doezer/Questarr/pull/1172) | Verified the applicable docs and browser coverage in QuestarrNG; preserve its 1.10.0 release identity and secure HTTP opt-in defaults. Upstream tagging and publication remain Doezer release operations.                                                             |
| [#1166: release scoring engine](https://github.com/Doezer/Questarr/pull/1166)   | Engine-only PR with substantial review follow-ups. Review latest head, title utility prerequisites and regex dependency. Link closed #1103 and issue #1090; full release-scoring feature may require persistence, search integration and UI beyond this PR.           |
| [#1131: RAWG metadata](https://github.com/Doezer/Questarr/pull/1131)            | The maintainer requested RAWG as an optional alternative, not an IGDB replacement. QuestarrNG implements that direction with separate IDs and passing stubbed-provider tests; a live RAWG API response still needs an operator key.                                   |

These findings were preliminary; the follow-up sections record completed implementation and final dispositions.

## First implementation batch

Issue [#1169](https://github.com/Doezer/Questarr/issues/1169) and PR
[#1170](https://github.com/Doezer/Questarr/pull/1170): ported the SABnzbd category
fallback and five upstream regression cases from Vincent A's commit
`58d984d2cda90f1b04fffb5deffb15527dbeeec5`. Requests now select the explicit
category, then the saved downloader category, then `games`.

The two configured-category cases failed before the fix; all 19 tests in the
two SABnzbd suites pass afterward. TypeScript checking and changed-production-file
lint pass. [Before](evidence/sabnzbd-before.txt) and
[after](evidence/sabnzbd-after.txt) results are retained.

The reporter subsequently said the upstream fix still did not work on a dev
image. We reproduced the full path through Questarr's authenticated downloader
API and SABnzbd 5.1.3: the configured category survived save and reload, Test
Connection succeeded, a request without its own category entered the saved
category, and an explicit request category overrode it. With no configured
category, the adapter uses `games`. SABnzbd maps unregistered category names to
`*` (Default), so the compatibility guide now calls out that the category must
also exist in SABnzbd. Both entries are now `verified`; the test queue was
cleared and no Usenet server was configured, so no content was downloaded.
See [batch 6](evidence/validation-batch-6.txt).

## Refresh and review workflow

Run from this checkout, using the repository's RTK wrapper when installed:

```sh
rtk git fetch upstream
rtk node scripts/audit-upstream.mjs
```

An optional directory argument imports `questarr-upstream-issues.json` and
`questarr-upstream-prs.json` produced by equivalent `gh ... list --json` exports.
The tool preserves per-item reviews, records source digests and flags changed
sources. It does not silently promote items to resolved. For a final review,
fetch all paginated issue comments/timeline events and PR discussions/review
threads, plus relevant diffs, then record evidence in the ledger.

Suggested review states: `unreviewed`, `investigating`, `needs-implementation`,
`implemented-unverified`, `verified`, `duplicate`, `superseded`,
`decision-required`, `not-applicable`. Terminal dispositions need a rationale
and links to the replacement or supporting evidence.

## Working location

The campaign starts in the isolated `codex/upstream-resolution` branch and
`QuestarrNG-upstream-resolution` sibling worktree. The original
`codex/validation-live-progress` checkout remains available for its existing work.

## Validated integration checkpoint — October 12, 2026

Upstream main through `fb650bab` is merged with fork behavior preserved. This
includes import/library discovery, backlog roulette, download recovery, archive
update handling and Prowlarr changes. The unsafe blanket HTTP-consent backfill is
excluded: revoked consent stays revoked.

The next batch adds thumbnail update badges (#923), Hydra-format JSON catalogs
(#336), strict torrent-manifest extension filtering (#406), the standalone release
scoring engine (#1166), and Prowlarr release-preparation fixes/coverage (#1172).
The scoring source comes from upstream head `9998f5a9`; its Jessomadic/Questarr
GPL attribution remains in the source. Release-preparation ports come from
`07d7386b`.

Validation: 3,997 tests passed, seven skipped; statements 84.62%, branches 77.44%,
functions 82.02%, lines 86.02%. TypeScript, lint, secret scanning and production
build pass. See [checkpoint evidence](evidence/validation-batch-1.txt).
Running UI screenshots are in `docs/pr-evidence/upstream-*.png`.

This is a checkpoint, **not completion of all 1,147 items**. Optional RAWG support
and issue #1081's per-user Socket.IO delivery are now implemented; federation,
integrated scoring profiles, real-service checks and most historical per-item
reviews remain. The ledger distinguishes verified behavior from integration work
still awaiting real external services. No upstream issue or PR has been closed.

## Follow-up: optional RAWG provider

RAWG is now available as an optional, additive metadata and discovery provider
from **Settings → Integrations**. It stores a separate provider ID, encrypts the
API key, keeps IGDB active for SeerrNG, applies per-user content filters and
provides attribution only when RAWG is configured. See [RAWG setup and terms](../RAWG.md).
Upstream PR #1131 remains open; its maintainer explicitly asked for this optional
provider behavior. The browser journey passes with stubbed RAWG results, but a
live response remains unverified until a valid API key is available.

Issue #906 is recorded as `not-applicable`: its author explicitly states the
federation specification is an offer, not a feature request. Closed PR #1103 is
now verified: release profiles persist, manual searches explain and sort scored
results, and opt-in automatic search admits only accepted releases. PR #1083 is
`not-applicable` because it only records the same protocol offer in contributor
documentation. Issue #406 is also verified: search checks the actual torrent
manifest and follows SSRF-checked redirects; unknown, magnet and Usenet results
are excluded with the limitation shown in the running UI. Issue #336 is verified:
operators can configure Hydra-format public HTTPS catalogs, and their torrent
links join normal aggregated search with source attribution. Catalog origin does
not certify release safety; the existing scanning controls remain applicable.
At that checkpoint, the ledger had 1,037 unreviewed records. Each of the four open issues
and four open PRs has a preliminary disposition; review status is tracked
separately from GitHub state. Issue #37 still needs the remaining mutation
routes moved to shared Zod validation.

## Follow-up: v1.5.0 release-preparation coverage (#1172)

The latest PR head is 9a4fd4d8. QuestarrNG now has quick-start, indexer/Prowlarr,
notification and RSS guides, a 33-page Mintlify navigation map, and a more
detailed Import guide covering archive updates, Wii U, recovery, ClamAV review,
disc images and Sort Extras. Twenty-six browser journeys for roulette, Discover,
settings organization and post-RC1 behavior pass, along with 60 focused
Prowlarr/SSRF unit tests. Version-specific 1.5.0 metadata is not copied over the
fork's current 1.10.0 identity. Existing HTTP integrations remain opted out
unless an operator explicitly grants that permission. Doezer retains control of
the upstream merge, tag and release publication.

## Follow-up: dependency and CI security fixes (#1186)

The fork already had PyJWT 2.15.1, a `fast-copy` 4.1.0+ override, no Tailwind
Typography or selector-parser dependency, and a single `engine.io` override.
QuestarrNG now pins Semgrep 1.180.0 in its hash-locked CI toolchain and records
that fork-specific update under v1.10.0. A clean hash-checked install passed,
`uv pip check` passed, the npm audit reported zero vulnerabilities, and the
configured SAST scan covered 928 tracked files with zero ERROR-severity
findings. The scan produced one WARNING on a route that checks both lexical and
real-path containment. This disposition resolves the applicable request while
leaving Doezer's PR open for its maintainer.

## Follow-up: per-user Socket.IO events

Issue [#1081](https://github.com/Doezer/Questarr/issues/1081) is verified. Every
private `notifyUser` event is routed to the authenticated owner's socket room,
including download status, library scan progress, game refreshes and import task
updates. Events without a known owner are dropped. Socket tests cover delivery
between two users and unknown-owner suppression; the full unit suite passes.

## Follow-up: early API, download and startup requests (#1–25, #237/#245/#260)

The shared download-status contract now lives in `shared/schema.ts`. Database
environment settings are validated through Zod with an explicit Postgres opt-in,
and indexer/downloader PATCH bodies pass through shared Zod schemas before
reaching storage. QuestarrNG's Copilot instructions now describe the current
React 19/Vite 8/Express 5 stack and the dual-database layout. Existing discovery
download actions, qBittorrent support, download details/history, indexer
categories/testing, carousel controls, and first-user setup/login were checked
against their original requests.

The production image was rebuilt and smoke-tested: `nanoid` resolved at runtime,
both migration journals were packaged, first-start migrations completed, and
the health and protected SeerrNG routes returned their expected responses. Issue
#260 is `not-applicable`: the report showed a Compose hostname/internal-port
mismatch, and the reporter confirmed that a clean pull fixed it.

At that checkpoint, the ledger had 1,105 unreviewed items, 38 verified, 3
`not-applicable`, and one implemented-but-unverified integration. The full suite
passed with 4,016 tests and 7 skips; typecheck, lint, format, production build,
and PostgreSQL schema checks also passed. The downloads-page screenshot was
captured after its loading state settled and is included in the review evidence:

![Downloads page after loading](../pr-evidence/upstream-download-status.png)

## Follow-up: early search and product requests (#26–60, PRs #61–69)

Multi-indexer search, background notifications, library statistics, settings,
health/readiness probes, downloader fallback and rTorrent support, indexer
controls, download details/errors, authentication, and structured error handling
are present in the fork and documented per item in the ledger. The health
request uses separate liveness and readiness routes so public probes do not
reveal component-specific details.

IGDB search now retries transient 429 and 5xx responses for at most three
requests, honors bounded `Retry-After` delays, and reduces routine search logs to
debug level. The PostCSS `from` setting from PR #101 is restored in Vite; the
production build has no PostCSS warning. Issue #37 remains open in the ledger:
validation is not yet uniformly Zod-based across every POST/PATCH body.

This batch passed the full suite with 4,019 tests and 7 skips, plus typecheck,
lint, and production build. See [batch 10 evidence](evidence/validation-batch-10.txt).
The ledger now has 1,062 unreviewed items, 80 verified, 3 `not-applicable`, one
implemented-but-unverified integration, and one item still needing implementation.

## Follow-up: cleanup, dependency, and deployment requests (#70–95)

The next slice covers Replit cleanup, dependency upgrades, the indexer sidebar,
downloader fallback and rTorrent support, rate limiting, indexer test UI,
discovery downloads, and on-demand image publishing. Current package and action
versions supersede the historical dependency PRs. Dependabot now requests only
labels available in this fork, and the README documents the manual image
workflow and where runtime credentials belong. Review feedback was checked
against current source, including replies on several threads that remain marked
unresolved upstream.

This batch passed formatting and YAML parsing checks. No application code changed;
the latest full run remains 4,019 tests passed and 7 skipped. The ledger now has
1,037 unreviewed items, 105 verified, 3 `not-applicable`, one
implemented-but-unverified integration, and one item still needing
implementation. See
[batch 11 evidence](evidence/validation-batch-11.txt).

Public source snapshots redact database connection strings found in support
reports; the collection script applies the same redaction on refresh.

## Follow-up: settings, multi-select, runtime, and dependency requests (#96–111)

PR #96 asked to restore `drizzle-zod` 0.7 after the 0.8.3 type migration failed;
the maintainer then requested a migration instead of a revert. Merged PR #110
now supplies that migration, so #96 is recorded as superseded. The read-only
settings API is protected by the default-deny authentication boundary and omits
the IGDB client ID. Client-only game fields are filtered before API submission,
example directories are excluded from typechecking, and health/readiness probes
remain available. Dependency PRs #104–108 are satisfied by newer locked package
versions and pinned checkout actions.

The Torznab category multi-select request (#102) was already implemented, but
reviewing its accessibility behavior exposed nested buttons: each category's
remove button lived inside the popover trigger button. The trigger now reports
the selection count and removable category badges sit outside it. A component
test verifies removal does not open the trigger, and the running indexer dialog
was checked in a browser. The [multi-select screenshot](../pr-evidence/upstream-torznab-multiselect.png)
is ready to attach to the eventual upstream PR description.

Issue #109 and PR #111 cover Replit cleanup and working development/production
builds. No Replit runtime artifacts remain. Development mode was exercised via
`npm run dev:test`; the production build and server start passed, and the
`/api/health`, `/login`, and nested `/activity/imports` routes returned HTTP 200. PR #103's downloader error response and notifications were verified in the
current route and client consumers. PR #101's PostCSS fix and PR #110's
`drizzle-zod` migration also pass the current build and typecheck.
The three records flagged by source digest (#237, #245, and #260) were also
rechecked. #237's last comment uses `localhost` for PostgreSQL inside the app
container, a hostname configuration issue also explained in #260; its original
nanoid and first-start migration problems are fixed.

Batch 12 passed the full suite (**4,020 passed, 7 skipped**), typecheck, lint,
format check, and production build. The browser test used a stubbed category
response; it did not contact a live indexer. The ledger now has **120 verified**,
**1 superseded**, **1,021 unreviewed**, **3 not-applicable**, **1
implemented-but-unverified**, and **1 needs-implementation** record. Issue #37
still needs shared Zod validation across every POST/PATCH route. See
[batch 12 evidence](evidence/validation-batch-12.txt).

## Follow-up: discovery, logging, downloads, and downloader requests (#112–125)

All fourteen PRs in this range were reviewed against their descriptions and
available discussion/review feedback. The nominal workflow and discovery
carousel requests are already supported; aggregated indexer search, typed Zod
configuration, bounded IGDB search, qBittorrent/rTorrent support, downloader
priority explanations, and download detail views are present. The abandoned
minimal qBittorrent PR #123 is superseded by #119. Dependency PRs #124–125 are
satisfied by newer locked versions.

Review found two implementation gaps. Several logging paths covered by PR #114
still used `console`, and unsafe bundle URLs were written into the warning; all
now use structured Pino logging without echoing the URL. PR #121's requested
unique genre, platform, and wishlist counts were missing from the current Stats
page; those cards are now present and tested. PR #122's rTorrent tracker query
requested five fields but interpreted ten, which made tracker state/error
reporting inaccurate. The matching XML-RPC fields are now requested and mapped,
with a fallback for older servers. The [running Stats page screenshot](../pr-evidence/upstream-global-library-stats.png)
is ready to include in the eventual upstream PR description.

Batch 13 passed the full suite (**4,022 passed, 7 skipped**), typecheck, lint,
format check, and production build. The Stats page was opened through
`npm run dev:test` in a headless browser; game/config responses were stubbed for
repeatable screenshot data. The refreshed upstream snapshot still contains
1,147 items. The ledger now has **133 verified**, **2 superseded**, **1,007
unreviewed**, **3 not-applicable**, **1 implemented-but-unverified**, and **1
needs-implementation** record. Issue #37 remains the outstanding implementation
item. See [batch 13 evidence](evidence/validation-batch-13.txt).
