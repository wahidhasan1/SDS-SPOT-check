import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("AI Coach returns labeled demo feedback that can be saved and reviewed", async ({ page }) => {
  await onboard(page, "Coach Student");
  await page.goto("/coach");
  await expect(page.getByText("Demo analyzer").first()).toBeVisible();
  await page.getByLabel("Practice prompt").selectOption("cp-job");
  await page.getByRole("button", { name: "Use a sample answer" }).click();
  await page.getByRole("button", { name: "Analyze Response" }).click();
  await expect(page.getByText("Demo analyzer (rule-based)")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("I have been working here for two years as a designer.").first()).toBeVisible();
  await expect(page.getByText(/Use "for" with a length of time/).first()).toBeVisible();
  await expect(page.getByText("Not measured — fluency feedback needs a recording")).toBeVisible();

  await page.getByRole("button", { name: "Save to My Learning" }).first().click();
  await expect(page.getByText("Saved to My Learning")).toBeVisible();

  await page.goto("/coach/saved");
  await expect(page.getByText("I have been working here for two years as a designer.")).toBeVisible();
  await page.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(page.getByText("Marked as reviewed")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Reviewed (1)" })).toBeVisible();
});
