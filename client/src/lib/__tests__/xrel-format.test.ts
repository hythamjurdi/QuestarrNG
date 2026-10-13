import { beforeEach, describe, expect, it } from "vitest";
import { formatXrelSize } from "@/lib/xrel-format";
import { setRegionalPreference } from "@/lib/regional-format";

describe("xREL release sizes", () => {
  beforeEach(() => {
    localStorage.clear();
    setRegionalPreference("system");
  });

  it("shows a dash when the release has no size", () => {
    expect(formatXrelSize()).toBe("—");
  });

  it("formats MB values using the selected regional numbering system", () => {
    setRegionalPreference("ar");

    expect(formatXrelSize(1536.5, "MB")).toBe(`${new Intl.NumberFormat("ar").format(1536.5)} MB`);
  });

  it("formats explicit GB values with one fractional digit", () => {
    setRegionalPreference("de");

    expect(formatXrelSize(1.5, "GB")).toBe(
      `${new Intl.NumberFormat("de", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(1.5)} GB`
    );
  });

  it("converts unitless values of at least 1024 MB to GB", () => {
    setRegionalPreference("de");

    expect(formatXrelSize(1536)).toBe(
      `${new Intl.NumberFormat("de", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(1.5)} GB`
    );
  });

  it("formats other explicit units with regional digits", () => {
    setRegionalPreference("ar");

    expect(formatXrelSize(2.5, "TB")).toBe(`${new Intl.NumberFormat("ar").format(2.5)} TB`);
  });
});
