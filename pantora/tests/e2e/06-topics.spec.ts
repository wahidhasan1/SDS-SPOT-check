import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("topics can be searched, filtered, favorited, and started", async ({ page }) => {
  await onboard(page, "Topic Fan");
  await page.goto("/topics");
  await expect(page.getByText("Showing 40 of 40 topics")).toBeVisible();

  await page.getByLabel("Search topics").fill("weekend");
  await expect(page.getByTestId("topic-card")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "My Ideal Weekend" })).toBeVisible();

  await page.getByLabel("Search topics").fill("");
  await page.getByLabel("Filter by category").selectOption("technology");
  await expect(page.getByTestId("topic-card")).toHaveCount(4);
  await page.getByLabel("Filter by difficulty").selectOption("challenging");
  await expect(page.getByTestId("topic-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear filters" }).click();

  await page.getByRole("button", { name: "Add My Ideal Weekend to favorites" }).click();
  await expect(page.getByText("Added to favorites")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Favorites \(1\)/ }).click();
  await expect(page.getByTestId("topic-card")).toHaveCount(1);

  await page.getByTestId("topic-card").getByRole("link", { name: "Free Talk" }).click();
  await expect(page).toHaveURL(/free-talk\?topic=ideal-weekend/);
  await expect(page.getByLabel("Topic", { exact: true })).toHaveValue("ideal-weekend");
});
