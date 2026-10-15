#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import console from "node:console";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const shaPattern = /^[a-f0-9]{40,64}$/i;
const signoffPattern = /^Signed-off-by:\s*(.+?)\s*<([^<>\s@]+@[^<>\s@]+)>\s*$/;

export function hasValidDcoSignoff(message) {
  const normalized = String(message).replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  if (!normalized) return false;

  const paragraphs = normalized.split(/\n[ \t]*\n/);
  const footer = paragraphs.at(-1);
  return footer.split("\n").some((line) => {
    const match = signoffPattern.exec(line);
    return Boolean(match?.[1].trim());
  });
}

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function checkDcoRange({ baseSha, headSha, cwd = process.cwd() }) {
  for (const [label, sha] of [
    ["base", baseSha],
    ["head", headSha],
  ]) {
    if (!shaPattern.test(String(sha ?? ""))) {
      throw new Error("The " + label + " commit must be a full hexadecimal SHA.");
    }
  }

  const mergeBase = git(["merge-base", baseSha, headSha], cwd);
  const commits = git(["rev-list", "--no-merges", mergeBase + ".." + headSha], cwd)
    .split(/\r?\n/)
    .filter(Boolean);
  const missing = [];

  for (const commit of commits) {
    const message = execFileSync("git", ["show", "-s", "--format=%B", commit], {
      cwd,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (!hasValidDcoSignoff(message)) missing.push(commit);
  }

  return { mergeBase, checked: commits.length, missing };
}

export function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name !== "--base" && name !== "--head") {
      throw new Error("Usage: node scripts/check-dco.mjs --base <sha> --head <sha>");
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Usage: node scripts/check-dco.mjs --base <sha> --head <sha>");
    }
    options[name === "--base" ? "baseSha" : "headSha"] = value;
    index += 1;
  }
  if (!options.baseSha || !options.headSha) {
    throw new Error("Usage: node scripts/check-dco.mjs --base <sha> --head <sha>");
  }
  for (const [label, sha] of [
    ["base", options.baseSha],
    ["head", options.headSha],
  ]) {
    if (!shaPattern.test(sha)) {
      throw new Error("The " + label + " commit must be a full hexadecimal SHA.");
    }
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = checkDcoRange(parseArguments(process.argv.slice(2)));
    if (report.missing.length > 0) {
      console.error(
        "DCO failed: " +
          report.missing.length +
          " non-merge commit(s) are missing a valid Signed-off-by trailer:"
      );
      for (const commit of report.missing) console.error("  " + commit);
      process.exitCode = 1;
    } else {
      console.log(
        "DCO passed: validated " +
          report.checked +
          " non-merge commit(s); merge commits are excluded."
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "DCO check failed.");
    process.exitCode = 1;
  }
}
