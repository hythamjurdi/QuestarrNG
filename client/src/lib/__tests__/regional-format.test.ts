import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { setInterfaceLanguage } from "../interface-locale";
import { formatBytes as formatDownloadsBytes, formatSpeed } from "../downloads-utils";
import { formatBytes as formatGeneralBytes, parseReleaseDate } from "../utils";
import {
  formatRegionalDistanceToNow,
  getRegionalCollator,
  formatRegionalPercent,
  getRegionalDateFnsLocale,
  getRegionalDirection,
  getRegionalLocale,
  getRegionalPreference,
  getRegionalWeekStartsOn,
  REGIONAL_FORMAT_KEY,
  setRegionalPreference,
  useRegionalPreference,
} from "../regional-format";

describe("regional formatting locale", () => {
  beforeEach(() => {
    localStorage.clear();
    setInterfaceLanguage("en");
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

  it("ignores unsupported regional-format preferences", () => {
    setRegionalPreference("unsupported");

    expect(getRegionalPreference()).toBe("system");
  });

  it("uses interface-language wording with regional formatting for relative time", () => {
    setInterfaceLanguage("es");
    setRegionalPreference("ja");

    const relativeTime = formatRegionalDistanceToNow(new Date(Date.now() - 60 * 60 * 1000));
    expect(getRegionalDateFnsLocale()?.code).toBe("ja");
    expect(relativeTime).toContain("hace");
    expect(relativeTime).not.toContain("前");
  });

  it("uses regional digits in relative-time text", () => {
    setInterfaceLanguage("en");
    setRegionalPreference("ar");

    expect(formatRegionalDistanceToNow(new Date(Date.now() - 60 * 60 * 1000))).toBe(
      `about ${new Intl.NumberFormat("ar", { useGrouping: false }).format(1)} hour ago`
    );
  });

  it("formats release years with the system locale's digits for dated and year-only releases", () => {
    setRegionalPreference("system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "fa-IR" } as Intl.ResolvedDateTimeFormatOptions);

    try {
      const expectedYear = new Intl.NumberFormat("fa-IR", { useGrouping: false }).format(2026);
      expect(parseReleaseDate("2026-12-31").year).toBe(expectedYear);
      expect(parseReleaseDate("2026-10-13").year).toBe(expectedYear);
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it("formats zero-byte sizes and speeds with the system locale's digits", () => {
    setRegionalPreference("system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "ar-EG" } as Intl.ResolvedDateTimeFormatOptions);

    try {
      const zero = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(0);
      expect(formatGeneralBytes(0)).toBe(zero + " B");
      expect(formatDownloadsBytes(0)).toBe(zero + " B");
      expect(formatSpeed(0)).toBe(zero + " B/s");
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it.each(["fr", "de", "ar"])(
    "formats percentages with the locale's percent conventions for %s",
    (locale) => {
      setRegionalPreference(locale);

      expect(formatRegionalPercent(25, { maximumFractionDigits: 0 })).toBe(
        new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(0.25)
      );
    }
  );

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

  it("uses interface-language wording when the browser regional locale is unlisted", () => {
    setRegionalPreference("system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "ru-RU" } as Intl.ResolvedDateTimeFormatOptions);
    const now = Date.now();
    const date = new Date(now - 60 * 60 * 1000);

    try {
      expect(getRegionalDateFnsLocale()).toBeUndefined();
      expect(formatRegionalDistanceToNow(date)).toBe("about 1 hour ago");
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it("formats near-zero relative times in the interface language", () => {
    setRegionalPreference("system");
    const relativeTime = formatRegionalDistanceToNow(new Date(Date.now() + 1));
    expect(relativeTime).toContain("less than");
    expect(relativeTime).toContain("minute");
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

  it("uses valid Intl week data when the first day is Sunday", () => {
    setRegionalPreference("system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "en-GB" } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi
      .spyOn(Intl.Locale.prototype, "getWeekInfo")
      .mockImplementation(() => ({ firstDay: 7 }) as never);

    try {
      expect(getRegionalWeekStartsOn()).toBe(0);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });

  it.each([
    ["en-US", 0],
    ["en-AF", 6],
    ["en-MV", 5],
    ["en-GB-u-rg-uszzzz", 0],
    ["en-GB-u-rg-001zzzz", 1],
    ["en", 0],
  ])("uses CLDR region fallback data for %s", (locale, expected) => {
    setRegionalPreference("system");
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi.spyOn(Intl.Locale.prototype, "getWeekInfo").mockImplementation(() => {
      throw new TypeError("Simulate a browser without usable week data");
    });

    try {
      expect(getRegionalWeekStartsOn()).toBe(expected);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });

  it("falls back to the language subtag when Intl cannot parse the locale", () => {
    expect(getRegionalDirection("ar-??")).toBe("rtl");
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

  it("uses the active preference when resolving a regional locale", () => {
    expect(getRegionalLocale()).toBeUndefined();
    expect(getRegionalLocale("de")).toBe("de");
  });

  it("uses the active preference for collation by default", () => {
    setRegionalPreference("de");

    expect(getRegionalCollator().resolvedOptions().locale).toBe("de");
  });

  it("syncs supported regional-format preferences from storage events", () => {
    localStorage.setItem(REGIONAL_FORMAT_KEY, "de");
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-key" }));
    expect(getRegionalPreference()).toBe("system");

    window.dispatchEvent(new StorageEvent("storage", { key: REGIONAL_FORMAT_KEY }));
    expect(getRegionalPreference()).toBe("de");

    localStorage.setItem(REGIONAL_FORMAT_KEY, "unsupported");
    window.dispatchEvent(new StorageEvent("storage", { key: REGIONAL_FORMAT_KEY }));
    expect(getRegionalPreference()).toBe("system");

    localStorage.removeItem(REGIONAL_FORMAT_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(getRegionalPreference()).toBe("system");

    vi.stubGlobal("localStorage", undefined);
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
      expect(getRegionalPreference()).toBe("system");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses language direction when a locale has no maximized script", () => {
    const maximize = vi
      .spyOn(Intl.Locale.prototype, "maximize")
      .mockReturnValue({ script: undefined } as never);

    try {
      expect(getRegionalDirection("ar-SA")).toBe("rtl");
      expect(getRegionalDirection("en-US")).toBe("ltr");
    } finally {
      maximize.mockRestore();
    }
  });

  it.each([
    ["zh-Hant-HK", "zh-TW"],
    ["zh-Hans", "zh-CN"],
  ])("maps fallback Chinese locale %s to date-fns locale %s", (locale, expected) => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale } as Intl.ResolvedDateTimeFormatOptions);

    try {
      expect(getRegionalDateFnsLocale()?.code).toBe(expected);
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it("falls back to en-US when the browser reports an empty locale", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "" } as Intl.ResolvedDateTimeFormatOptions);

    try {
      expect(getRegionalDateFnsLocale()?.code).toBe("en-US");
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it("falls back to en-US when Intl cannot resolve the browser locale", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => {
        throw new TypeError("Simulate a browser without locale resolution");
      });

    try {
      expect(getRegionalDateFnsLocale()?.code).toBe("en-US");
    } finally {
      resolvedOptions.mockRestore();
    }
  });

  it("uses legacy Intl.Locale weekInfo when getWeekInfo has no usable data", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "en-US" } as Intl.ResolvedDateTimeFormatOptions);
    const getWeekInfo = vi
      .spyOn(Intl.Locale.prototype, "getWeekInfo")
      .mockReturnValue({ firstDay: undefined } as never);
    const originalWeekInfo = Object.getOwnPropertyDescriptor(Intl.Locale.prototype, "weekInfo");
    Object.defineProperty(Intl.Locale.prototype, "weekInfo", {
      configurable: true,
      value: { firstDay: 2 },
    });

    try {
      expect(getRegionalWeekStartsOn()).toBe(2);
    } finally {
      getWeekInfo.mockRestore();
      if (originalWeekInfo) {
        Object.defineProperty(Intl.Locale.prototype, "weekInfo", originalWeekInfo);
      } else {
        delete (Intl.Locale.prototype as Intl.Locale & { weekInfo?: unknown }).weekInfo;
      }
      resolvedOptions.mockRestore();
    }
  });

  it("ignores invalid Intl week data and uses the locale region", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "en-US" } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi
      .spyOn(Intl.Locale.prototype, "getWeekInfo")
      .mockReturnValue({ firstDay: 0 } as never);

    try {
      expect(getRegionalWeekStartsOn()).toBe(0);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });

  it("uses the Sunday-first fallback for Traditional Chinese without region data", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "zh-Hant" } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi.spyOn(Intl.Locale.prototype, "getWeekInfo").mockImplementation(() => {
      throw new TypeError("Simulate a browser without usable week data");
    });

    try {
      expect(getRegionalWeekStartsOn()).toBe(0);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });

  it("uses Monday when neither Intl nor date-fns has region data", () => {
    const resolvedOptions = vi
      .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ locale: "ru" } as Intl.ResolvedDateTimeFormatOptions);
    const weekInfo = vi.spyOn(Intl.Locale.prototype, "getWeekInfo").mockImplementation(() => {
      throw new TypeError("Simulate a browser without usable week data");
    });

    try {
      expect(getRegionalWeekStartsOn()).toBe(1);
    } finally {
      weekInfo.mockRestore();
      resolvedOptions.mockRestore();
    }
  });
});
