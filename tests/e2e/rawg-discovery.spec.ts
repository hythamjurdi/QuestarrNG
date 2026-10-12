import { test, expect } from "@playwright/test";

test("optional RAWG provider saves its key and powers the discovery tab", async ({ page }) => {
  await page.route("**/api/config", async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({ json: { ...config, rawg: { configured: true, source: "database" } } });
  });
  const sample = {
    id: "rawg-4312",
    rawgId: 4312,
    rawgSlug: "sample-game",
    title: "Sample Game",
    summary: "A game from the RAWG provider",
    coverUrl: "",
    releaseDate: "2020-04-05",
    rating: 8.5,
    platforms: ["PC"],
    genres: ["Adventure"],
    status: null,
    isReleased: true,
    igdbId: null,
  };
  const samples = [
    sample,
    { ...sample, id: "rawg-4313", rawgId: 4313, rawgSlug: "emberfall", title: "Emberfall" },
    { ...sample, id: "rawg-4314", rawgId: 4314, rawgSlug: "quiet-harbor", title: "Quiet Harbor" },
    { ...sample, id: "rawg-4315", rawgId: 4315, rawgSlug: "ironwood", title: "Ironwood" },
    { ...sample, id: "rawg-4316", rawgId: 4316, rawgSlug: "far-signal", title: "Far Signal" },
    { ...sample, id: "rawg-4317", rawgId: 4317, rawgSlug: "wild-atlas", title: "Wild Atlas" },
  ];
  await page.route("**/api/rawg/popular?*", (route) => route.fulfill({ json: samples }));
  await page.route("**/api/rawg/recent?*", (route) => route.fulfill({ json: samples }));
  await page.route("**/api/rawg/upcoming?*", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/rawg/search?*", (route) => route.fulfill({ json: [sample] }));

  await page.goto("/settings");
  await page.getByRole("tab", { name: "Integrations" }).click();
  await page.getByLabel("RAWG API key").fill("test-rawg-key");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/settings/rawg") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save RAWG key" }).click();
  expect((await saved).ok()).toBe(true);
  const persistedSettings = await page.request.get("/api/settings/rawg");
  expect(await persistedSettings.json()).toEqual({ configured: true, apiKey: "********" });
  await page.goto("/discover");
  await page.getByRole("tab", { name: "RAWG" }).click();
  await expect(page.getByText("Sample Game").first()).toBeVisible();
  await page.screenshot({ path: "docs/pr-evidence/upstream-rawg-discovery.png" });
  await page.getByLabel("Search RAWG games").fill("Sample");
  await expect(page.getByText("RAWG Search Results")).toBeVisible();
  await expect(page.getByText("Sample Game").first()).toBeVisible();
});
