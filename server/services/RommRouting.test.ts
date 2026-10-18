import { describe, expect, it } from "vitest";
import { resolveRommPlatformDir, sanitizeFsName, validateRommSlug } from "./RommRouting.js";

describe("RomM platform routing", () => {
  it("normalizes a safe platform slug", () => {
    expect(validateRommSlug("  Nintendo-64 ")).toBe("nintendo-64");
  });

  it.each(["", "   ", "../nes", "nintendo/64", "nintendo\\64", "bad slug", "a?b"])(
    "rejects unsafe platform slug %s",
    (slug) => {
      expect(() => validateRommSlug(slug)).toThrow("RomM fs_slug");
    }
  );

  it("uses the slug directory when routing by slug", () => {
    expect(
      resolveRommPlatformDir({ libraryRoot: "/games", fsSlug: "SNES", routingMode: "slug" })
    ).toBe("/games/snes");
  });

  it("adds RomM's roms/ folder under the platform with the platform-roms layout", () => {
    expect(
      resolveRommPlatformDir({
        libraryRoot: "/romm",
        fsSlug: "PS2",
        routingMode: "slug-subfolder",
        folderLayout: "platform-roms",
      })
    ).toBe("/romm/ps2/roms");
  });

  it("falls back to the layout-shaped folder for an unbound platform", () => {
    expect(
      resolveRommPlatformDir({
        libraryRoot: "/romm",
        fsSlug: "psx",
        routingMode: "binding-map",
        bindings: { n64: "N64/games" },
        folderLayout: "platform-roms",
      })
    ).toBe("/romm/psx/roms");
  });

  it("takes a custom binding as-is regardless of the layout", () => {
    expect(
      resolveRommPlatformDir({
        libraryRoot: "/romm",
        fsSlug: "n64",
        routingMode: "binding-map",
        bindings: { n64: "N64/games" },
        folderLayout: "platform-roms",
      })
    ).toBe("/romm/N64/games");
  });

  it("resolves a configured binding under the library root", () => {
    expect(
      resolveRommPlatformDir({
        libraryRoot: "/games",
        fsSlug: "n64",
        routingMode: "binding-map",
        bindings: { n64: "Nintendo/64" },
      })
    ).toBe("/games/Nintendo/64");
  });

  it("falls back to the slug directory when a binding is absent", () => {
    expect(
      resolveRommPlatformDir({
        libraryRoot: "/games",
        fsSlug: "n64",
        routingMode: "binding-map",
      })
    ).toBe("/games/n64");
  });

  it("can fail when a binding is missing", () => {
    expect(() =>
      resolveRommPlatformDir({
        libraryRoot: "/games",
        fsSlug: "n64",
        routingMode: "binding-map",
        bindingMissingBehavior: "error",
      })
    ).toThrow("No RomM binding configured for slug 'n64'");
  });

  it.each(["../outside", "/outside"])("rejects binding path %s outside the root", (binding) => {
    expect(() =>
      resolveRommPlatformDir({
        libraryRoot: "/games",
        fsSlug: "nes",
        routingMode: "binding-map",
        bindings: { nes: binding },
      })
    ).toThrow("escapes library root");
  });

  it("removes filesystem-reserved characters and normalizes whitespace", () => {
    expect(sanitizeFsName('  A/B:*?"<>|\\\tGame  ')).toBe("A B Game");
  });
});
