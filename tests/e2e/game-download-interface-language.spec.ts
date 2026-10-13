import { test, expect, type Page } from "@playwright/test";

const game = {
  id: "test-game-id-123",
  title: "Localization Demo",
  coverUrl: "",
  platforms: ["PC"],
  genres: ["Adventure"],
  status: "wanted",
  addedAt: "2026-10-01T00:00:00.000Z",
  igdbId: 1877,
  hidden: false,
};

async function openLocalizedBundle(page: Page, updateCount: number) {
  await page.addInitScript(() => {
    localStorage.setItem("questarr.interface-language", "ar");
  });

  await page.route("/api/games*", async (route) => {
    await route.fulfill({ json: [game] });
  });
  await page.route("**/api/indexers/enabled", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/downloaders/enabled", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/search?*", async (route) => {
    const updates = Array.from({ length: updateCount }, (_, index) => ({
      title: `Localization Demo Update ${index + 1}`,
      link: `magnet:?xt=urn:btih:UPDATE${index + 1}`,
      pubDate: "2026-10-01T00:00:00.000Z",
      seeders: 10,
      group: "Example Group",
      indexerName: "Example Indexer",
    }));
    await route.fulfill({
      json: {
        items: [
          {
            title: "Localization Demo Full",
            link: "magnet:?xt=urn:btih:MAIN",
            pubDate: "2026-10-01T00:00:00.000Z",
            seeders: 20,
            group: "Example Group",
            indexerName: "Example Indexer",
          },
          ...updates,
        ],
        total: updateCount + 1,
        offset: 0,
      },
    });
  });

  await page.goto("/");
  await page.getByTestId(`card-game-${game.id}`).click();
  await page.getByTestId("button-download-game").click();
  const downloadDialog = page.getByRole("dialog", {
    name: "تنزيل Localization Demo",
    exact: true,
  });
  await expect(downloadDialog).toHaveAttribute("dir", "rtl");
  await downloadDialog.getByRole("button", { name: "تنزيل Localization Demo Full" }).waitFor();
  return downloadDialog.getByRole("button", { name: "تنزيل Localization Demo Full" });
}

test.describe("Game download interface language", () => {
  test("marks translated calendar labels and release counts with their language", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    await page.addInitScript(() => {
      localStorage.setItem("questarr.interface-language", "ar");
      localStorage.setItem("questarrng.regional-format", "ar");
    });
    await page.route("**/api/config", async (route) =>
      route.fulfill({ json: { igdb: { configured: true } } })
    );
    await page.route("**/api/games*", async (route) =>
      route.fulfill({
        json: [
          {
            ...game,
            id: "calendar-game",
            title: "Calendar Localization Demo",
            releaseDate: `${year}-12-15`,
          },
        ],
      })
    );

    await page.goto("/calendar");
    const previousPeriod = page.getByRole("button", { name: "الفترة السابقة" });
    await expect(previousPeriod).toHaveAttribute("lang", "ar");
    await expect(previousPeriod).toHaveAttribute("dir", "rtl");

    const emptyMonthLabel = page.getByText("لا توجد إصدارات", { exact: true }).first();
    await expect(emptyMonthLabel).toBeVisible();
    await expect(emptyMonthLabel).toHaveAttribute("lang", "ar");
    await expect(emptyMonthLabel).toHaveAttribute("dir", "rtl");

    await page.getByRole("combobox").click();
    await page.getByRole("option").nth(1).click();
    const monthsToDecember = (11 - new Date().getMonth() + 12) % 12;
    for (let index = 0; index < monthsToDecember; index += 1) {
      await page.getByRole("button", { name: "الفترة التالية" }).click();
    }
    const releaseCountButton = page.locator('button[aria-label*="إصدار"]').first();
    await expect(releaseCountButton).toHaveAttribute("lang", "ar");
    await expect(releaseCountButton).toHaveAttribute("dir", "rtl");
  });

  test("localizes nested filter controls and singular update copy", async ({ page }) => {
    const downloadButton = await openLocalizedBundle(page, 1);
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toHaveAttribute("lang", "ar");
    await expect(downloadButton).toHaveAttribute("dir", "rtl");

    await page.getByRole("button", { name: "إظهار عوامل التصفية" }).click();
    await page.getByText("اختر المجموعات...").click();
    const filterPopover = page.locator('[data-radix-popper-content-wrapper] [role="dialog"]');
    await expect(filterPopover).toHaveAttribute("dir", "rtl");
    const filterSearch = page.getByPlaceholder("بحث...");
    await expect(filterSearch).toHaveAttribute("lang", "ar");
    await expect(filterSearch).toHaveAttribute("dir", "rtl");
    await filterSearch.fill("no matching group");
    const emptyState = page.getByText("لم يتم العثور على عناصر.");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveAttribute("lang", "ar");
    await expect(emptyState).toHaveAttribute("dir", "rtl");
    await page.keyboard.press("Escape");

    await downloadButton.click();
    const bundleDialog = page.getByRole("alertdialog");
    await expect(bundleDialog).toBeVisible();
    await expect(bundleDialog).toHaveAttribute("dir", "rtl");
    await expect(bundleDialog).toContainText(
      "يتوفر تحديث واحد لهذه اللعبة. اختر ما إذا كنت تريد تنزيله مع اللعبة الأساسية."
    );
    await expect(bundleDialog.getByRole("button", { name: "تنزيل مع تحديث واحد" })).toBeVisible();
  });

  test("uses the dual form when two updates are available and selected", async ({ page }) => {
    const downloadButton = await openLocalizedBundle(page, 2);
    await expect(downloadButton).toBeVisible();
    await downloadButton.click();

    const bundleDialog = page.getByRole("alertdialog");
    await expect(bundleDialog).toBeVisible();
    await expect(bundleDialog).toContainText(
      "يتوفر تحديثان لهذه اللعبة. اختر ما إذا كنت تريد تنزيلهما مع اللعبة الأساسية."
    );
    await expect(bundleDialog.getByText("التحديد: 2/2")).toBeVisible();
    await expect(bundleDialog.getByRole("button", { name: "تنزيل مع تحديثين" })).toBeVisible();
  });

  test("sets RTL direction on the mobile download drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLocalizedBundle(page, 1);

    const downloadDrawer = page.getByRole("dialog", {
      name: "تنزيل Localization Demo",
      exact: true,
    });
    await expect(downloadDrawer).toHaveAttribute("dir", "rtl");
  });
});
