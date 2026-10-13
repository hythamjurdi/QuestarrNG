#!/usr/bin/env node
// Refresh the upstream inventory without treating GitHub closure as proof of delivery.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import path from "node:path";
import { redactSnapshot, stableSnapshotStringify } from "./upstream-source-redaction.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "docs/upstream-resolution");
const repository = "Doezer/Questarr";
const run = (command, args) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const git = (...args) => run("git", args).trim();
const fields = {
  issue: "number,title,state,closedAt,createdAt,updatedAt,url,body,comments,labels",
  pr: "number,title,state,mergedAt,closedAt,createdAt,updatedAt,url,body,headRefOid,baseRefName,mergeCommit",
};
const sourceDirectory = process.argv[2];
// Keep source context for review, but never persist copied credentials or
// signed guest-share tokens from public issue discussions.
const previousSourcesPath = path.join(destination, "sources.json");
const previousSources = existsSync(previousSourcesPath)
  ? JSON.parse(readFileSync(previousSourcesPath, "utf8"))
  : null;
const sources = Object.fromEntries(
  Object.entries(fields).map(([kind, json]) => {
    const filename = kind === "issue" ? "issues" : "prs";
    const rows = JSON.parse(
      sourceDirectory
        ? readFileSync(path.join(sourceDirectory, `questarr-upstream-${filename}.json`), "utf8")
        : run("gh", [
            kind,
            "list",
            "--repo",
            repository,
            "--state",
            "all",
            "--limit",
            "10000",
            "--json",
            json,
          ])
    );
    if (!Array.isArray(rows) || rows.length >= 10000) {
      throw new Error(`Invalid or potentially truncated ${kind} inventory; use paginated export.`);
    }
    if (new Set(rows.map((row) => row.number)).size !== rows.length) {
      throw new Error(`Duplicate ${kind} numbers in inventory`);
    }
    return [kind, redactSnapshot(rows)];
  })
);
const ancestors = new Set(git("rev-list", "HEAD").split("\n"));
const upstreamAncestors = new Set(git("rev-list", "upstream/main").split("\n"));
const ledgerPath = path.join(destination, "ledger.json");
const previous = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, "utf8"))
  : { items: [] };
const reviews = new Map(previous.items.map((item) => [item.key, item]));
const items = Object.entries(sources)
  .flatMap(([kind, rows]) =>
    rows.map((row) => {
      const key = `${kind}:${row.number}`;
      const old = reviews.get(key);
      const previousSource = previousSources?.[kind]?.find(
        (previousRow) => previousRow.number === row.number
      );
      // Preserve the existing digest when the only difference is newly
      // redacted secret material. This keeps privacy cleanup from being
      // mistaken for an upstream source edit that requires renewed triage.
      const unchangedAfterRedaction =
        old &&
        previousSource &&
        stableSnapshotStringify(redactSnapshot(previousSource)).replaceAll(
          "[redacted database connection string]\x60",
          "[redacted database connection string]"
        ) ===
          stableSnapshotStringify(row).replaceAll(
            "[redacted database connection string]\x60",
            "[redacted database connection string]"
          );
      const sourceDigest = unchangedAfterRedaction
        ? old.sourceDigest
        : createHash("sha256").update(stableSnapshotStringify(row)).digest("hex");
      const mergeOid = row.mergeCommit?.oid;
      return {
        key,
        number: row.number,
        kind,
        title: row.title,
        url: row.url,
        upstreamState: row.state,
        upstreamUpdatedAt: row.updatedAt,
        sourceDigest,
        historyEvidence: mergeOid
          ? ancestors.has(mergeOid)
            ? "merge-commit-in-fork-history"
            : upstreamAncestors.has(mergeOid)
              ? "merge-commit-in-upstream-main-only"
              : "merge-commit-not-in-either-main-history"
          : "no-merge-commit",
        mergeCommit: mergeOid ?? null,
        // Keep human review separate from mechanical ancestry observations.
        review: old?.review ?? {
          status: "unreviewed",
          findings: [],
          acceptance: [],
          evidence: [],
          dependencies: [],
        },
        sourceChangedSinceReview: old
          ? Boolean(old.sourceChangedSinceReview || old.sourceDigest !== sourceDigest)
          : false,
      };
    })
  )
  .sort((a, b) => a.number - b.number);
const counts = {};
for (const item of items) {
  const key = `${item.kind}:${item.upstreamState}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
const inventory = {
  repository,
  capturedAt: new Date().toISOString(),
  forkHead: git("rev-parse", "HEAD"),
  upstreamHead: git("rev-parse", "upstream/main"),
  counts,
  limitations: [
    "Ancestry is not behavioral verification: changes can be reverted, superseded or ported with different hashes.",
    "List exports include issue discussion but do not prove discussion pagination completeness. Fetch full issue timelines before final review.",
    "PR review threads, comments, changed files and checks must be fetched separately before final review.",
    "Refresh upstream refs with git fetch upstream before collecting a live snapshot.",
    "Passing a source directory imports an earlier snapshot; capturedAt records ledger generation time, not each GitHub request time.",
  ],
  items,
};
mkdirSync(destination, { recursive: true });
writeFileSync(ledgerPath, JSON.stringify(inventory, null, 2) + "\n");
writeFileSync(path.join(destination, "sources.json"), JSON.stringify(sources, null, 2) + "\n");
const safe = (text) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
writeFileSync(
  path.join(destination, "inventory.md"),
  `# Upstream inventory\n\nGenerated by \`scripts/audit-upstream.mjs\`. See [the resolution plan](README.md) and [ledger](ledger.json).\n\n` +
    `Snapshot: ${inventory.capturedAt}. ${items.length} items. All ancestry observations require behavioral review.\n\n` +
    "| Item | Title | GitHub state | History observation | Review |\n| --- | --- | --- | --- | --- |\n" +
    items
      .map(
        (item) =>
          `| [${item.kind} #${item.number}](${item.url}) | ${safe(item.title)} | ${item.upstreamState} | ${item.historyEvidence} | ${item.review.status} |`
      )
      .join("\n") +
    "\n"
);
console.log(JSON.stringify({ total: items.length, counts, destination }, null, 2));
