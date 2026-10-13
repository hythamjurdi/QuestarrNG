import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import {
  formatRegionalDistanceToNow,
  getRegionalDateFnsLocale,
  getRegionalDirection,
  getRegionalWeekStartsOn,
  setRegionalPreference,
  useRegionalPreference,
} from "../regional-format";

describe("regional formatting locale", () => {
  beforeEach(() => {
    localStorage.clear();
    setRegionalPreference("system");
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
    setRegionalPreference(locale);

    expect(getRegionalWeekStartsOn()).toBe(expected);
  });

  it("uses the selected locale for relative time", () => {
    setRegionalPreference("es");

    expect(getRegionalDateFnsLocale()?.code).toBe("es");
    expect(formatRegionalDistanceToNow(new Date(Date.now() - 60 * 60 * 1000))).toContain("hace");
  });

  it.each([
    ["ar", "rtl"],
    ["fa-IR", "rtl"],
    ["he-IL", "rtl"],
    ["ur-PK", "rtl"],
    ["ps-AF", "rtl"],
    ["en-US", "ltr"],
    ["ku-Latn", "ltr"],
  ] as const)("detects the text direction for %s", (locale, direction) => {
    expect(getRegionalDirection(locale)).toBe(direction);
  });

  it("uses the browser locale when the preference is set to system", () => {
    setRegionalPreference("system");

    expect(getRegionalDateFnsLocale()).toBeDefined();
    expect(getRegionalWeekStartsOn()).toBe(
      new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).getWeekInfo().firstDay % 7
    );
  });

  it("uses Intl relative-time formatting for an unlisted browser locale", () => {
    setRegionalPreference("system");
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
    setRegionalPreference("system");
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

  it("uses a region-specific first weekday when Intl week data is unavailable", () => {
    setRegionalPreference("system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "en-NZ" } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi.spyOn(Intl.Locale.prototype, "getWeekInfo").mockImplementation(() => {
      throw new TypeError("Simulate a browser without usable week data");
    });

    try {
      expect(getRegionalDateFnsLocale()?.code).toBe("en-NZ");
      expect(getRegionalWeekStartsOn()).toBe(1);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });

  it("rerenders subscribers when the active regional preference changes", () => {
    function PreferenceProbe() {
      return createElement("span", null, useRegionalPreference());
    }

    render(createElement(PreferenceProbe));
    expect(screen.getByText("system")).toBeInTheDocument();

    act(() => setRegionalPreference("de"));

    expect(screen.getByText("de")).toBeInTheDocument();
  });
});
