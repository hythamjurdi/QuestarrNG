import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatRegionalDistanceToNow,
  getRegionalDateFnsLocale,
  getRegionalWeekStartsOn,
  REGIONAL_FORMAT_KEY,
} from "../regional-format";

describe("regional formatting locale", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    ["es", 1],
    ["zh-CN", 1],
    ["hi-IN", 0],
    ["de", 1],
    ["ja", 0],
    ["fr", 1],
    ["pt-BR", 0],
    ["ar", 6],
    ["ko", 0],
    ["zh-TW", 0],
    ["vi", 1],
    ["id", 0],
  ])("uses the locale's first weekday for %s", (locale, expected) => {
    localStorage.setItem(REGIONAL_FORMAT_KEY, locale);

    expect(getRegionalWeekStartsOn()).toBe(expected);
  });

  it("uses the selected locale for relative time", () => {
    localStorage.setItem(REGIONAL_FORMAT_KEY, "es");

    expect(getRegionalDateFnsLocale()?.code).toBe("es");
    expect(formatRegionalDistanceToNow(new Date(Date.now() - 60 * 60 * 1000))).toContain("hace");
  });

  it("uses the browser locale when the preference is set to system", () => {
    localStorage.setItem(REGIONAL_FORMAT_KEY, "system");

    expect(getRegionalDateFnsLocale()).toBeDefined();
    expect(getRegionalWeekStartsOn()).toBe(
      new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).getWeekInfo().firstDay % 7
    );
  });

  it("uses Intl relative-time formatting for an unlisted browser locale", () => {
    localStorage.setItem(REGIONAL_FORMAT_KEY, "system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "ru-RU" } as Intl.ResolvedDateTimeFormatOptions);
    const now = Date.now();
    const date = new Date(now - 60 * 60 * 1000);

    try {
      expect(getRegionalDateFnsLocale()).toBeUndefined();
      expect(formatRegionalDistanceToNow(date)).toBe(
        new Intl.RelativeTimeFormat("ru-RU", { numeric: "auto" }).format(-1, "hour")
      );
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it("uses the Hong Kong Traditional Chinese locale and Sunday-first fallback", () => {
    localStorage.setItem(REGIONAL_FORMAT_KEY, "system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "zh-HK" } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi.spyOn(Intl.Locale.prototype, "getWeekInfo").mockImplementation(() => {
      throw new TypeError("Simulate a browser without usable week data");
    });

    try {
      expect(getRegionalDateFnsLocale()?.code).toBe("zh-HK");
      expect(getRegionalWeekStartsOn()).toBe(0);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });
});
