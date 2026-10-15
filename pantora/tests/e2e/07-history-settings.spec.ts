import { expect, test } from "@playwright/test";
import { onboard, signInDemo } from "./helpers";

test("history filters, sorts, and opens a session review with transcript actions", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/history");
  await page.getByRole("radio", { name: "Speaking Battles" }).click();
  await expect(page).toHaveURL(/type=battle/);
  const rows = page.locator('main a[href^="/history/"]');
  await expect(rows.first()).toBeVisible();
  for (const text of await rows.allTextContents()) expect(text).toContain("Speaking Battle");

  await page.getByRole("radio", { name: "All" }).click();
  await page.getByLabel("Sort by").selectOption("longest");
  await expect(page).toHaveURL(/sort=longest/);
  await page.getByLabel("Status").selectOption("incomplete");
  await expect(page.getByText(/^1 session/)).toBeVisible();
  await page.getByLabel("Status").selectOption("all");

  await page.goto("/history?type=free_talk");
  // Other tests may add their own "My Ideal Weekend" sessions; open the preloaded sample one.
  await page.locator('main a[href^="/history/"]').filter({ hasText: "My Ideal Weekend" }).filter({ hasText: "Sample" }).first().click();
  await expect(page.getByText("Sample transcript", { exact: true })).toBeVisible();
  await expect(page.getByText("scripted demo line").first()).toBeVisible();
  const markButtons = page.getByRole("button", { name: "Mark reviewed" });
  if (await markButtons.count()) {
    await markButtons.first().click();
    await expect(page.getByText("Lesson marked as reviewed")).toBeVisible();
  }
});

test("settings persist and apply across the app", async ({ page }) => {
  await onboard(page, "Settings User");
  await page.goto("/settings");
  await page.locator("#profile").getByRole("radio", { name: "15 min" }).click();
  await expect(page.getByText("Unsaved changes").first()).toBeVisible();
  await page.locator("#profile").getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();

  await page.locator("#accessibility").getByRole("switch", { name: "Reduce motion" }).click();
  await page.locator("#accessibility").getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("#accessibility").getByText(/Saved at/)).toBeVisible();

  await page.getByRole("textbox", { name: "Display name" }).fill("x");
  await page.locator("#profile").getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator("#profile").getByText("Display name must be at least 2 characters.").first()).toBeVisible();

  await page.reload();
  await expect(page.locator("#profile").getByRole("radio", { name: "15 min" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#accessibility").getByRole("switch", { name: "Reduce motion" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  await page.goto("/dashboard");
  await expect(page.getByText("of 15 min")).toBeVisible();
});
