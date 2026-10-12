import { describe, expect, it } from "vitest";

import { injectCuratedNotes } from "../release-notes.mjs";

describe("injectCuratedNotes", () => {
  it("finds a version heading with a release date without building a regex from the version", () => {
    const changelog = "## [1.7.3] - 2026-10-02\n\n### Security\n\n- Summary.\n";
    const result = injectCuratedNotes(changelog, "### User-facing changes\n\n- Note.", "1.7.3");

    expect(result).toContain("## [1.7.3] - 2026-10-02");
    expect(result).toContain("### User-facing changes\n\n- Note.");
    expect(result.indexOf("### User-facing changes")).toBeLessThan(result.indexOf("### Security"));
  });

  it("keeps an already assembled release section unchanged on rerun", () => {
    const changelog = "## [1.8.0] - 2026-10-03\n\n## [1.7.3] - 2026-10-02\n";
    const notes = "### User-facing changes\n\n#### Changed\n\n- Note.";
    const firstPass = injectCuratedNotes(changelog, notes, "1.8.0");

    expect(injectCuratedNotes(firstPass, notes, "1.8.0")).toBe(firstPass);
  });

  it("creates a dated version section when release notes have no prepared heading", () => {
    const changelog =
      "# Changelog\n\nAll notable changes are documented here.\n\n" +
      "## [1.9.2] - 2026-10-06\n\n- Previous release.\n";
    const notes = "### User-facing changes\n\n#### Added\n\n- New behavior.";

    const result = injectCuratedNotes(changelog, notes, "1.9.3", "2026-10-12");

    expect(result).toBe(
      "# Changelog\n\nAll notable changes are documented here.\n\n" +
        "## [1.9.3] - 2026-10-12\n\n" +
        `${notes}\n\n` +
        "## [1.9.2] - 2026-10-06\n\n- Previous release.\n"
    );
    expect(injectCuratedNotes(result, notes, "1.9.3", "2026-10-12")).toBe(result);
  });

  it("rejects invalid release dates", () => {
    expect(() => injectCuratedNotes("# Changelog\n", "Notes.", "1.9.3", "2026-02-30")).toThrow(
      "Invalid changelog date: 2026-02-30."
    );
  });

  it("rejects a changelog version outside the numeric semver format", () => {
    expect(() => injectCuratedNotes("## [1.7.3]", "Notes.", "1.7.3-questarr")).toThrow(
      "Invalid changelog version: 1.7.3-questarr."
    );
  });
});
