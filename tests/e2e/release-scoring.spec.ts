import { test, expect } from "@playwright/test";
import { patchUserSettings } from "./helpers";

test.describe("Release scoring settings", () => {
  test("saves and reloads a profile and a custom format", async ({ page }, testInfo) => {
    const response = await page.request.get("/api/settings");
    expect(response.ok()).toBe(true);
    const original = await response.json();

    try {
      await page.goto("/settings");
      await page.getByRole("tab", { name: "Discovery & Downloads" }).click();
      const enabledSwitch = page.getByLabel("Use this profile");
      if ((await enabledSwitch.getAttribute("aria-checked")) !== "true") {
        await enabledSwitch.click();
      }
      await page.getByLabel("Minimum score").fill("25");
      await page.getByLabel("Required title terms").fill("GOG");
      await page.getByRole("button", { name: "Add format" }).click();
      await page.getByLabel("Name", { exact: true }).last().fill("E2E GOG format");
      await page.getByPlaceholder("Text to match").fill("GOG");

      await page.getByRole("button", { name: "Save Release Scoring" }).click();
      await expect(page.getByText("Release scoring saved", { exact: true })).toBeVisible();

      const savedResponse = await page.request.get("/api/settings");
      expect(savedResponse.ok()).toBe(true);
      const saved = await savedResponse.json();
      expect(saved.releaseScoringEnabled).toBe(true);
      const savedConfig = JSON.parse(saved.releaseScoringProfile);
      expect(savedConfig.profile.minScore).toBe(25);
      expect(savedConfig.profile.requiredTerms).toEqual(["GOG"]);
      expect(savedConfig.formats).toEqual([
        expect.objectContaining({
          name: "E2E GOG format",
          specs: [expect.objectContaining({ field: "title", mode: "contains", value: "GOG" })],
        }),
      ]);

      await page.reload();
      await page.getByRole("tab", { name: "Discovery & Downloads" }).click();
      await expect(page.getByLabel("Use this profile")).toHaveAttribute("aria-checked", "true");
      await expect(page.getByLabel("Minimum score")).toHaveValue("25");
      await expect(page.getByLabel("Name", { exact: true }).last()).toHaveValue("E2E GOG format");
      await page.setViewportSize({ width: 1280, height: 960 });
      await page.getByText("Release Scoring", { exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath("release-scoring-settings.png"),
        fullPage: true,
      });
      await page.getByRole("heading", { name: "Custom formats" }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath("release-scoring-formats.png") });
    } finally {
      await patchUserSettings(page, {
        releaseScoringEnabled: original.releaseScoringEnabled ?? false,
        releaseScoringProfile: original.releaseScoringProfile ?? null,
      });
    }
  });

  test("explains a rejected release in the manual search dialog", async ({ page }, testInfo) => {
    const game = {
      id: "scoring-library-game",
      igdbId: 990099,
      title: "Scoring Quest",
      status: "wanted",
      platforms: ["PC"],
      genres: [],
      hidden: false,
      coverUrl: "",
      addedAt: new Date().toISOString(),
    };
    const release = {
      title: "Scoring.Quest-RUNE",
      link: "magnet:?xt=urn:btih:0123456789012345678901234567890123456789",
      guid: "scoring-release",
      indexerName: "Test indexer",
      seeders: 20,
      size: 1024 * 1024 * 1024,
      pubDate: new Date().toISOString(),
      downloadType: "torrent",
      releaseEvaluation: {
        accepted: false,
        score: 40,
        lines: [{ ruleId: "title_contains", label: "Title contains the game", points: 70 }],
        rejections: [{ code: "below_min_score", detail: "40" }],
        titleMatch: "contains",
        indexerCategory: "unknown",
        category: "main",
        matchedFormats: [],
        preferredProtocol: true,
      },
    };

    await page.route("/api/games*", (route) => route.fulfill({ json: [game] }));
    await page.route("/api/indexers/enabled", (route) => route.fulfill({ json: [] }));
    await page.route("/api/downloaders/enabled", (route) => route.fulfill({ json: [] }));
    await page.route("/api/search?*", (route) =>
      route.fulfill({ json: { items: [release], total: 1, offset: 0 } })
    );

    await page.goto("/");
    await page.getByTestId(`card-game-${game.id}`).first().click();
    await page.getByTestId("button-download-game").click();
    const dialog = page.getByRole("dialog").last();
    const score = dialog.getByText("Rejected · 40", { exact: true });
    await expect(score).toBeVisible();
    await expect(score).toHaveAttribute("title", /below min score: 40/);
    await dialog.screenshot({ path: testInfo.outputPath("release-scoring-manual-search.png") });
  });
});
