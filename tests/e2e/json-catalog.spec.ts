import { test, expect } from "@playwright/test";
import { uniqueId } from "./helpers";

test("saves and reloads a JSON catalog without an API key", async ({ page }) => {
  const name = `Catalog ${uniqueId()}`;
  await page.goto("/indexers");
  await page.getByTestId("button-add-indexer").click();
  await page.getByTestId("input-indexer-name").fill(name);
  await page.getByTestId("select-indexer-protocol").click();
  await page.getByRole("option", { name: "JSON catalog (Hydra format)" }).click();
  await page.getByTestId("input-indexer-url").fill("https://example.com/catalog.json");
  await expect(page.getByTestId("input-indexer-apikey")).toBeDisabled();
  await page.screenshot({ path: "docs/pr-evidence/upstream-json-catalog.png" });
  const saved = page.waitForResponse(
    (response) => response.url().endsWith("/api/indexers") && response.request().method() === "POST"
  );
  await page.getByTestId("button-save-indexer").click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});
