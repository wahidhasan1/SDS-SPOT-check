import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

test("landing page explains Pantora and links to onboarding", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Speak Without Fear. Connect With the World.");
  for (const section of ["How Pantora works", "Free Talk", "Speaking Battles", "AI Speaking Coach", "Privacy and safety", "FAQ"]) {
    await expect(page.getByText(section, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("link", { name: "Explore Features" }).click();
  await expect(page).toHaveURL(/#features/);
  await page.getByRole("link", { name: "Start Speaking" }).first().click();
  await expect(page).toHaveURL(/\/onboarding/);
  expect(errors).toEqual([]);
});

test("public trust pages and 404 render", async ({ page }) => {
  await page.goto("/guidelines");
  await expect(page.getByRole("heading", { name: "Community guidelines" })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy overview" })).toBeVisible();
  await page.goto("/does-not-exist");
  await expect(page.getByText("We couldn't find that page")).toBeVisible();
});

test("app pages redirect to onboarding without a profile", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/onboarding/);
});
