import { expect, test } from "@playwright/test";
import { trackErrors } from "./helpers";

test("onboarding validates input, keeps selections, and creates a profile", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/onboarding");
  await expect(page.getByText("Step 1 of 7")).toBeVisible();
  await page.getByRole("button", { name: "Let's begin" }).click();

  // Display name validation
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Display name must be at least 2 characters.")).toBeVisible();
  await page.getByLabel("Display name").fill("Brave Owl");
  await page.getByRole("radio", { name: "Emerald" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Level
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Choose the level that feels closest.")).toBeVisible();
  await page.getByRole("radio", { name: /Intermediate/ }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Goals (multi-select), then go back and verify the level is still selected
  await page.getByRole("checkbox", { name: "Improve fluency" }).click();
  await page.getByRole("checkbox", { name: "Communicate for work" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("radio", { name: /^Intermediate/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("checkbox", { name: "Improve fluency" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /Both/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /10 minutes/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Step 7 of 7")).toBeVisible();
  await expect(page.getByText("Improve fluency, Communicate for work")).toBeVisible();
  await page.getByRole("button", { name: "Create my profile" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Pantora, Brave Owl!" })).toBeVisible();
  await page.getByRole("button", { name: "Go to my dashboard" }).click();

  await expect(page.getByRole("heading", { name: "Welcome back, Brave Owl!" })).toBeVisible();
  await expect(page.getByText("No sessions yet")).toBeVisible();
  await expect(page.getByText("0 of 10 min").or(page.getByText("of 10 min"))).toBeVisible();
  expect(errors).toEqual([]);
});
