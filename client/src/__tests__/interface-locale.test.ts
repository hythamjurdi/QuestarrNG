import { beforeEach, describe, expect, it } from "vitest";

import {
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
});
