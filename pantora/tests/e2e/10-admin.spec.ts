import { expect, test } from "@playwright/test";
import { signInDemo } from "./helpers";

test("demo admin shows records, updates reports, and resets demo data", async ({ page }) => {
  await signInDemo(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Enter demo admin" }).click();
  await expect(page.getByText("Reset demo data").first()).toBeVisible();

  await page.getByRole("link", { name: "Safety reports" }).click();
  await expect(page.getByText("PromoBot88 (sample)")).toBeVisible();
  const row = page.locator("li", { hasText: "QuietFox (sample)" });
  await row.getByLabel("Report status").selectOption("resolved");
  await row.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Report updated")).toBeVisible();

  await page.getByRole("link", { name: "Configuration" }).click();
  await expect(page.getByText("Demo fallback").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("sk-ant");

  await page.getByRole("link", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Reset everything" })).toBeDisabled();
  await dialog.getByLabel(/Type RESET/).fill("RESET");
  await dialog.getByRole("button", { name: "Reset everything" }).click();
  await expect(page.getByText("Demo data restored")).toBeVisible({ timeout: 20_000 });

  await page.goto("/dashboard");
  await expect(page.getByLabel(/6-day streak/)).toBeVisible();
  await page.goto("/history");
  await expect(page.getByText("20 sessions")).toBeVisible();
});

test("admin APIs reject requests without admin access", async ({ page }) => {
  await signInDemo(page);
  const res = await page.request.post("/api/admin/reset", { data: { confirm: "RESET" } });
  expect(res.status()).toBe(403);
});
