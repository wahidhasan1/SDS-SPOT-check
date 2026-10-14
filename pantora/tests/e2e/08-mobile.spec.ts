import { expect, test } from "@playwright/test";
import { signInDemo } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile navigation reaches every section", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  const menu = page.getByRole("dialog", { name: "Navigation menu" });
  await menu.getByRole("link", { name: "Topics" }).click();
  await expect(page).toHaveURL(/\/topics/);
  await expect(page.getByRole("dialog", { name: "Navigation menu" })).toBeHidden();
  await page.getByRole("navigation", { name: "Quick navigation" }).getByRole("link", { name: "Battles" }).click();
  await expect(page).toHaveURL(/\/battles/);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
});
