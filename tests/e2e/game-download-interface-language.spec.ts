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

async function openLocalizedBundle(
  page: Page,
  updateCount: number,
  regionalFormat?: string,
  ageDays?: number
) {
  const pubDate =
    ageDays === undefined
      ? "2026-10-01T00:00:00.000Z"
      : new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000).toISOString();

  await page.addInitScript((format) => {
    localStorage.setItem("questarr.interface-language", "ar");
    if (format) localStorage.setItem("questarrng.regional-format", format);
  }, regionalFormat);

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
      pubDate,
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
            pubDate,
            seeders: 12345,
            age: ageDays,
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
  test("keeps English when it is the highest-priority browser language", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("questarr.interface-language");
      Object.defineProperty(navigator, "languages", {
        configurable: true,
        value: ["en-US", "es"],
      });
    });

    await page.goto("/");

    await expect(page.getByTestId("nav-library")).toContainText("Library");
  });

  test("marks translated calendar labels and release counts with their language", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    await page.addInitScript(() => {
      localStorage.setItem("questarr.interface-language", "ar");
      localStorage.setItem("questarrng.regional-format", "ja");
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
          {
            ...game,
            id: "calendar-game-two",
            title: "Calendar Localization Demo Two",
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
    const releaseCountLabel = page.locator('span[id$="-releases"]').first();
    await expect(releaseCountLabel).not.toBeEmpty();
    await expect(releaseCountLabel).toHaveText("إصداران");
    await expect(releaseCountLabel).toHaveAttribute("lang", "ar");
    await expect(releaseCountLabel).toHaveAttribute("dir", "rtl");
    const releaseCountLabelId = await releaseCountLabel.getAttribute("id");
    expect(releaseCountLabelId).toBeTruthy();
    const releaseCountButton = page.locator(`button[aria-labelledby~="${releaseCountLabelId}"]`);
    await expect(releaseCountButton).toHaveCount(1);
    await expect(releaseCountButton).toHaveAccessibleName(/إصدار/u);
    await expect(releaseCountButton).not.toHaveAttribute("lang");
    await expect(releaseCountButton).toHaveAttribute("dir", "auto");
    const labelledByIds = (await releaseCountButton.getAttribute("aria-labelledby"))
      ?.split(/\s+/)
      .filter(Boolean);
    expect(labelledByIds).toContain(releaseCountLabelId);
    const dateLabelId = labelledByIds?.find((id) => id.endsWith("-date"));
    expect(dateLabelId).toBeTruthy();
    const calendarDate = dateLabelId?.match(/-(\d{4}-\d{2}-\d{2})-date$/u)?.[1];
    expect(calendarDate).toBeTruthy();
    if (!calendarDate) throw new Error("Calendar date label did not include a date.");
    const dateLabel = page.locator(`[id="${dateLabelId}"]`);
    await expect(dateLabel).toHaveAttribute("lang", "ja");
    await expect(dateLabel).toHaveAttribute("dir", "ltr");
    const expectedDateLabel = await page.evaluate((dateKey) => {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString("ja", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }, calendarDate);
    await expect(dateLabel).toHaveText(expectedDateLabel);
    await expect(releaseCountButton).toHaveAccessibleName(new RegExp(expectedDateLabel, "u"));
    if (process.env.PR47_VISUAL_EVIDENCE_DIR) {
      await page.screenshot({
        path: `${process.env.PR47_VISUAL_EVIDENCE_DIR}/pr47-calendar-arabic-dual.png`,
        fullPage: true,
      });
    }
  });

  test("formats translated calendar counts with regional digits", async ({ page }) => {
    const year = new Date().getFullYear();
    await page.addInitScript(() => {
      localStorage.setItem("questarr.interface-language", "es");
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
            id: "spanish-calendar-game-one",
            title: "Spanish Calendar Localization Demo One",
            releaseDate: `${year}-12-15`,
          },
          {
            ...game,
            id: "spanish-calendar-game-two",
            title: "Spanish Calendar Localization Demo Two",
            releaseDate: `${year}-12-15`,
          },
        ],
      })
    );

    await page.goto("/calendar");
    await page.getByRole("combobox").click();
    await page.getByRole("option").nth(1).click();
    const monthsToDecember = (11 - new Date().getMonth() + 12) % 12;
    for (let index = 0; index < monthsToDecember; index += 1) {
      await page.getByRole("button", { name: "Período siguiente" }).click();
    }

    const releaseCountLabel = page.locator('span[id$="-releases"]').first();
    const regionalTwo = await page.evaluate(() => new Intl.NumberFormat("ar").format(2));
    await expect(releaseCountLabel).toHaveText(`${regionalTwo} lanzamientos`);
    await expect(releaseCountLabel).toHaveAttribute("lang", "es");
    await expect(releaseCountLabel).toHaveAttribute("dir", "ltr");
    if (process.env.PR47_VISUAL_EVIDENCE_DIR) {
      await page.screenshot({
        path: `${process.env.PR47_VISUAL_EVIDENCE_DIR}/pr47-calendar-spanish-regional-count.png`,
        fullPage: true,
      });
    }
  });

  test("formats xREL megabyte sizes with regional digits", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("questarrng.regional-format", "ar");
    });
    await page.route("**/api/xrel/latest*", async (route) =>
      route.fulfill({
        json: {
          list: [
            {
              id: "xrel-regional-mb-size",
              dirname: "Example.Release-P2P",
              time: Math.floor(Date.now() / 1000),
              sizeMb: 1536.5,
              sizeUnit: "MB",
              source: "P2P",
              link_href: "https://xrel.to/example",
              group_name: "Example",
            },
          ],
          pagination: { current_page: 1, per_page: 10, total_pages: 1 },
          total_count: 1,
        },
      })
    );

    await page.goto("/xrel");
    const regionalSize = await page.evaluate(() =>
      new Intl.NumberFormat("ar", { maximumFractionDigits: 1 }).format(1536.5)
    );
    await expect(page.getByText(`${regionalSize} MB`, { exact: true })).toBeVisible();
    if (process.env.PR47_VISUAL_EVIDENCE_DIR) {
      await page.screenshot({
        path: `${process.env.PR47_VISUAL_EVIDENCE_DIR}/pr47-xrel-regional-mb-size.png`,
        fullPage: true,
      });
    }
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

  test("localizes category headings, metrics, and relative ages", async ({ page }) => {
    await openLocalizedBundle(page, 1, "ar");

    const updateHeading = page.getByRole("heading", {
      name: "التحديثات والتصحيحات",
      exact: true,
    });
    await expect(updateHeading).toBeVisible();
    const localizedHeading = updateHeading.locator('span[lang="ar"][dir="rtl"]');
    await expect(localizedHeading).toBeVisible();

    const seedersLabel = page.getByText("بذور", { exact: true }).first();
    await expect(seedersLabel).toBeVisible();
    await expect(seedersLabel).toHaveAttribute("lang", "ar");
    await expect(seedersLabel).toHaveAttribute("dir", "rtl");
    const regionalSeeders = await page.evaluate(() => new Intl.NumberFormat("ar").format(12345));
    const regionalOne = await page.evaluate(() => new Intl.NumberFormat("ar").format(1));
    await expect(page.getByText(regionalSeeders, { exact: true })).toBeVisible();
    await expect(updateHeading.locator("..").getByText(regionalOne, { exact: true })).toBeVisible();

    const relativeAge = page.locator('span[lang="ar"][dir="rtl"]').filter({ hasText: "قبل" });
    await expect(relativeAge.first()).toBeVisible();
  });

  test("uses the dual form when two updates are available and selected", async ({ page }) => {
    const downloadButton = await openLocalizedBundle(page, 2, "ar");
    await expect(downloadButton).toBeVisible();
    await downloadButton.click();

    const bundleDialog = page.getByRole("alertdialog");
    await expect(bundleDialog).toBeVisible();
    await expect(bundleDialog).toContainText(
      "يتوفر تحديثان لهذه اللعبة. اختر ما إذا كنت تريد تنزيلهما مع اللعبة الأساسية."
    );
    const regionalTwo = await page.evaluate(() => new Intl.NumberFormat("ar").format(2));
    await expect(bundleDialog.getByText(`التحديد: ${regionalTwo}/${regionalTwo}`)).toBeVisible();
    await expect(bundleDialog.getByRole("button", { name: "تنزيل مع تحديثين" })).toBeVisible();
  });

  test("sets RTL direction on the mobile download drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openLocalizedBundle(page, 1, "ar");

    const downloadDrawer = page.getByRole("dialog", {
      name: "تنزيل Localization Demo",
      exact: true,
    });
    await expect(downloadDrawer).toHaveAttribute("dir", "rtl");
    const regionalSeeders = await page.evaluate(() => new Intl.NumberFormat("ar").format(12345));
    await expect(downloadDrawer.getByText(regionalSeeders, { exact: false })).toBeVisible();
  });

  test("keeps numeric formatting tied to the regional preference", async ({ page }) => {
    await openLocalizedBundle(page, 1, "es", 12345);

    const downloadDialog = page.getByRole("dialog", {
      name: "تنزيل Localization Demo",
      exact: true,
    });
    await expect(downloadDialog.getByText("بذور", { exact: true }).first()).toBeVisible();
    const regionalSeeders = await page.evaluate(() => new Intl.NumberFormat("es").format(12345));
    await expect(downloadDialog.getByText(regionalSeeders, { exact: true })).toBeVisible();
    await expect(downloadDialog.getByText("12345", { exact: true })).toHaveCount(0);
    const regionalAge = await page.evaluate(() =>
      new Intl.RelativeTimeFormat("ar", { numeric: "always" })
        .format(-12345, "day")
        .replace(
          new Intl.NumberFormat("ar").format(12345),
          new Intl.NumberFormat("es").format(12345)
        )
    );
    await expect(downloadDialog.getByText(regionalAge, { exact: true }).first()).toBeVisible();
  });

  test("formats interpolated result counts with the regional preference", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("questarr.interface-language", "ar");
      localStorage.setItem("questarrng.regional-format", "es");
    });
    await page.route("/api/games*", async (route) => route.fulfill({ json: [game] }));
    await page.route("**/api/indexers/enabled", async (route) => route.fulfill({ json: [] }));
    await page.route("**/api/downloaders/enabled", async (route) => route.fulfill({ json: [] }));
    await page.route("**/api/search?*", async (route) =>
      route.fulfill({
        json: {
          items: [],
          total: 12345,
          offset: 0,
          blacklistedCount: 12345,
        },
      })
    );

    await page.goto("/");
    await page.getByTestId(`card-game-${game.id}`).click();
    await page.getByTestId("button-download-game").click();

    const dialog = page.getByRole("dialog", {
      name: "تنزيل Localization Demo",
      exact: true,
    });
    const regionalCount = await page.evaluate(() => new Intl.NumberFormat("es").format(12345));
    await expect(dialog.getByText(regionalCount, { exact: false })).toBeVisible();
    await expect(dialog.getByText("12345", { exact: false })).toHaveCount(0);
  });

  test("formats successful download toast counts regionally", async ({ page }) => {
    const downloadButton = await openLocalizedBundle(page, 2, "es");
    await page.route("**/api/downloads", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ json: [] });
        return;
      }

      await route.fulfill({
        json: {
          success: true,
          downloaderName: "Example Downloader",
        },
      });
    });

    await downloadButton.click();
    const bundleDialog = page.getByRole("alertdialog");
    await bundleDialog.getByRole("button", { name: "تنزيل مع تحديثين" }).click();

    const regionalThree = await page.evaluate(() => new Intl.NumberFormat("es").format(3));
    const successToast = page.getByText(`${regionalThree} download(s) sent to Example Downloader`, {
      exact: true,
    });
    await expect(successToast).toBeVisible();
    await expect(
      page.getByText(`Added ${regionalThree} of ${regionalThree} downloads`, { exact: true })
    ).toBeVisible();
  });

  test("formats failed download toast counts regionally", async ({ page }) => {
    const downloadButton = await openLocalizedBundle(page, 2, "es");
    let requestIndex = 0;
    await page.route("**/api/downloads", async (route) => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ json: [] });
        return;
      }

      requestIndex += 1;
      await route.fulfill({
        json: {
          success: requestIndex === 1,
          downloaderName: "Example Downloader",
        },
      });
    });

    await downloadButton.click();
    const bundleDialog = page.getByRole("alertdialog");
    await bundleDialog.getByRole("button", { name: "تنزيل مع تحديثين" }).click();

    const regionalTwo = await page.evaluate(() => new Intl.NumberFormat("es").format(2));
    const failureToast = page.getByText(`${regionalTwo} download(s) failed`, { exact: true });
    await expect(failureToast).toBeVisible();
  });
});
