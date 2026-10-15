import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { describe, expect, it } from "vitest";
import { checkDcoRange, hasValidDcoSignoff, parseArguments } from "./check-dco.mjs";

describe("DCO sign-off validation", () => {
  it("accepts a valid sign-off trailer in the commit footer", () => {
    expect(
      hasValidDcoSignoff("Add a feature\n\nSigned-off-by: Casey Example <casey@example.test>")
    ).toBe(true);
  });

  it("rejects a missing, malformed, or body-only sign-off", () => {
    expect(hasValidDcoSignoff("Add a feature")).toBe(false);
    expect(hasValidDcoSignoff("Add a feature\n\nSigned-off-by: <casey@example.test>")).toBe(false);
    expect(
      hasValidDcoSignoff(
        "Signed-off-by: Casey Example <casey@example.test>\n\nAdd a feature without a footer"
      )
    ).toBe(false);
  });

  it("requires both full commit SHAs as explicit arguments", () => {
    expect(parseArguments(["--base", "a".repeat(40), "--head", "b".repeat(40)])).toEqual({
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
    });
    expect(() => parseArguments(["--base", "main", "--head", "HEAD"])).toThrow(
      /full hexadecimal SHA/
    );
  });

  it("checks each contributed non-merge commit and excludes base and merge commits", () => {
    const cwd = mkdtempSync(join(tmpdir(), "questarr-dco-test-"));
    const runGit = (args) =>
      execFileSync("git", args, {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    const commit = (message, file, content) => {
      writeFileSync(join(cwd, file), content);
      runGit(["add", file]);
      runGit(["commit", "-m", message]);
      return runGit(["rev-parse", "HEAD"]);
    };

    try {
      runGit(["init", "-b", "main"]);
      runGit(["config", "user.name", "DCO Test Fixture"]);
      runGit(["config", "user.email", "dco-fixture@example.test"]);
      commit("Base commit", "base.txt", "base\n");

      runGit(["checkout", "-b", "feature"]);
      commit(
        "Signed contribution\n\nSigned-off-by: Test Contributor <test@example.test>",
        "signed.txt",
        "signed\n"
      );

      runGit(["checkout", "main"]);
      commit("Advance base", "upstream.txt", "base update\n");
      const baseSha = runGit(["rev-parse", "HEAD"]);

      runGit(["checkout", "feature"]);
      runGit(["merge", "--no-ff", "main", "-m", "Merge current base"]);
      const mergeSha = runGit(["rev-parse", "HEAD"]);
      const scriptPath = join(process.cwd(), "scripts/check-dco.mjs");
      const passed = spawnSync(
        process.execPath,
        [scriptPath, "--base", baseSha, "--head", mergeSha],
        { cwd, encoding: "utf8" }
      );
      expect(passed.status).toBe(0);

      const missingSha = commit("Unsigned contribution", "unsigned.txt", "unsigned\n");
      const headSha = runGit(["rev-parse", "HEAD"]);

      expect(checkDcoRange({ baseSha, headSha, cwd })).toEqual({
        mergeBase: baseSha,
        checked: 2,
        missing: [missingSha],
      });
      const failed = spawnSync(
        process.execPath,
        [scriptPath, "--base", baseSha, "--head", headSha],
        { cwd, encoding: "utf8" }
      );
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain(missingSha);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
