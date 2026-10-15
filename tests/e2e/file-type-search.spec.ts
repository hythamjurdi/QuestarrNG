import { test, expect } from "@playwright/test";

test("sends the verified extension filter and explains excluded unknown payloads", async ({
  page,
}, testInfo) => {
  const requests: URL[] = [];
  await page.route("**/api/search?*", async (route) => {
    requests.push(new URL(route.request().url()));
    await route.fulfill({ json: { items: [], total: 0, offset: 0, nextOffset: null } });
  });
  await page.goto("/search");
  await page.getByRole("button", { name: "Toggle filters" }).click();
  await page.getByLabel("Verified file types").fill("nsp,xci");
  await page.getByTestId("input-search-query").fill("Example Game");
  await expect.poll(() => requests.at(-1)?.searchParams.get("fileTypes")).toBe("nsp,xci");
  await expect(
    page.getByText(/Magnets, Usenet, archives, and unavailable file lists are excluded/)
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("upstream-file-type-search.png") });
  await page.getByLabel("Verified file types").clear();
  await expect.poll(() => requests.at(-1)?.searchParams.has("fileTypes")).toBe(false);
});
