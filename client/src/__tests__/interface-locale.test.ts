import { beforeEach, describe, expect, it } from "vitest";

import {
  INTERFACE_LANGUAGE_OPTIONS,
  applyInitialInterfaceLanguage,
  getInterfaceTextDirection,
  getInterfaceTextLanguage,
} from "@/lib/interface-locale";

describe("interface text language metadata", () => {
  beforeEach(() => {
    localStorage.setItem("questarr.interface-language", "ar");
    applyInitialInterfaceLanguage();
  });

  it("marks translated strings with their selected language", () => {
    expect(getInterfaceTextLanguage("Navigation", "ar")).toBe("ar");
    expect(getInterfaceTextLanguage("Navigation", "es")).toBe("es");
  });

  it("marks English fallback strings as English", () => {
    expect(getInterfaceTextLanguage("Initial Setup", "ar")).toBe("en");
    expect(getInterfaceTextDirection("Initial Setup", "ar")).toBe("ltr");
  });

  it("keeps document metadata aligned with English fallback content", () => {
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(getInterfaceTextDirection("Navigation", "ar")).toBe("rtl");
  });

  it("provides download-dialog and nested filter translations for every supported language", () => {
    const sources = [
      "Search...",
      "No items found.",
      "Remove {name}",
      "This result is blacklisted. Review the blacklist in game settings.",
      "One update is available for this game. Select whether to download it with the main game.",
      "Two updates are available for this game. Select whether to download them with the main game.",
      "Download with one update",
      "Download with two updates",
      "Download with {count} updates",
      "Selection: {count}/{total}",
      "No releases",
      "release",
      "releases",
      "two releases",
      "Extras",
      "No Release Date",
      "Release date TBD",
      "Delayed",
      "Was originally scheduled for:",
    ];

    for (const { value } of INTERFACE_LANGUAGE_OPTIONS) {
      if (value === "en") continue;
      for (const source of sources) {
        expect(getInterfaceTextLanguage(source, value), `${source} in ${value}`).toBe(value);
      }
    }
  });
});
