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

Initial inventory: **232 issues** (4 open, 228 closed) and **914 PRs** (3 open,
703 merged, 208 closed unmerged), for **1,146 items**.

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

| Item                                                                            | Required investigation / proposed treatment                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#923: update notification](https://github.com/Doezer/Questarr/issues/923)      | Maintainer comments say bell/Apprise notifications already exist and update management is in progress. Verify the actual fork behavior and thumbnail indication without duplicating notification machinery.                                                            |
| [#906: cross-server libraries](https://github.com/Doezer/Questarr/issues/906)   | This is a protocol proposal, not a completed specification for Questarr. Inspect the referenced protocol and closed PR #1083. Define identity, peer revocation, separate browse/download grants, local file boundaries and compatibility tests before implementation.  |
| [#406: file-type search](https://github.com/Doezer/Questarr/issues/406)         | Distinguish title/category hints from verified payload extensions. Inspect metadata availability and define unknown-file behavior; a title filter cannot truthfully guarantee an NSP-only payload.                                                                     |
| [#336: alternative game sources](https://github.com/Doezer/Questarr/issues/336) | Evaluate user-configured JSON catalogs and uploader filters through the existing acquisition pipeline. Validate schemas, provenance, refresh bounds and outbound URL handling. Catalog origin is not proof of malware safety.                                          |
| [#1172: v1.5 release preparation](https://github.com/Doezer/Questarr/pull/1172) | Port missing behavior, tests and useful docs after comparing with upstream/main. Keep QuestarrNG's release version and packaging identity. Review the actual diff, not just its release-oriented title.                                                                |
| [#1166: release scoring engine](https://github.com/Doezer/Questarr/pull/1166)   | Engine-only PR with substantial review follow-ups. Review latest head, title utility prerequisites and regex dependency. Link closed #1103 and issue #1090; full release-scoring feature may require persistence, search integration and UI beyond this PR.            |
| [#1131: RAWG metadata](https://github.com/Doezer/Questarr/pull/1131)            | Proposed PR removes IGDB. The fork's SeerrNG provider uses exact IGDB identity. Prefer additive RAWG provider support with explicit identity mapping and compatibility tests; do not erase IGDB credentials, mappings or contracts merely to apply the upstream patch. |

These are preliminary findings, not completed implementation or final dispositions.

## First implementation batch

Issue [#1169](https://github.com/Doezer/Questarr/issues/1169) and PR
[#1170](https://github.com/Doezer/Questarr/pull/1170): ported the SABnzbd category
fallback and five upstream regression cases from Vincent A's commit
`58d984d2cda90f1b04fffb5deffb15527dbeeec5`. Requests now select the explicit
category, then the saved downloader category, then `games`.

The two configured-category cases failed before the fix; all 19 tests in the
two SABnzbd suites pass afterward. TypeScript checking and changed-production-file
lint pass. [Before](evidence/sabnzbd-before.log) and
[after](evidence/sabnzbd-after.log) results are retained.

The reporter subsequently said the upstream fix still did not work on a dev
image. This adapter fix therefore remains `implemented-unverified` in the ledger
pending configuration persistence and a real SABnzbd reproduction. Mocked HTTP
tests demonstrate the outgoing category, not the downstream installation's
behavior. No item is yet marked fully resolved.

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
