import { test, expect } from "@playwright/test";
import { seedGame, uniqueId } from "./helpers";

test("identifies update releases on library thumbnails and clears the badge with fresh results", async ({
  page,
}, testInfo) => {
  const id = uniqueId();
  const title = `Update available ${id}`;
  await page.goto("/");
  const game = await seedGame(page, { title, igdbId: id, status: "owned" });
  let available = true;
  // Simulate the availability persisted by an indexer search; use the real library UI.
  await page.route("**/api/games?*", async (route) => {
    const response = await route.fetch();
    const games = await response.json();
    await route.fulfill({
      response,
      json: games.map((item: { id: string }) =>
        item.id === game.id
          ? { ...item, searchResultsAvailable: available, updateSearchResultsAvailable: available }
          : item
      ),
    });
  });
  await page.reload();
  await page.getByPlaceholder("Search your library…").fill(title);
  const card = page.getByTestId(`card-game-${game.id}`);
  await expect(
    card.getByRole("status", { name: "Game updates available on indexers" })
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("upstream-update-available.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    card.getByRole("status", { name: "Game updates available on indexers" })
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("upstream-update-available-mobile.png") });
  available = false;
  await page.reload();
  await page.getByPlaceholder("Search your library…").fill(title);
  await expect(card).toBeVisible();
  await expect(
    card.getByRole("status", { name: "Game updates available on indexers" })
  ).toHaveCount(0);
});
