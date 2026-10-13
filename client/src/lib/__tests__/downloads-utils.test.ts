import { describe, expect, it } from "vitest";
import { formatAge } from "@/lib/downloads-utils";

describe("formatAge", () => {
  it("keeps existing English labels when no locale is requested", () => {
    expect(formatAge(undefined)).toBe("");
    expect(formatAge(0)).toBe("Today");
    expect(formatAge(0.5)).toBe("< 1 day");
    expect(formatAge(1)).toBe("1 day");
    expect(formatAge(3)).toBe("3 days");
  });

  it("uses localized relative time for fractional and whole-day ages", () => {
    expect(formatAge(0.5, "es")).toBe("hace 12 horas");
    expect(formatAge(1, "fr")).toBe("il y a 1 jour");
    expect(formatAge(2, "ja")).toBe("2 日前");
    expect(formatAge(2, "ar")).toBe("قبل يومين");
  });
});
