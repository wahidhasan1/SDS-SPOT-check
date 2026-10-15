import { expect, test } from "@playwright/test";
import { onboard, signInDemo, trackErrors } from "./helpers";

test("demo account: full Free Talk flow extends the streak and unlocks an achievement", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = trackErrors(page);
  await page.clock.install();
  await signInDemo(page);
  await page.goto("/dashboard");
  await expect(page.getByLabel(/6-day streak/).first()).toBeVisible();

  await page.goto("/free-talk");
  await page.getByRole("button", { name: "Start Matching" }).click();
  await expect(page.getByText("Searching for a partner")).toBeVisible();
  await expect(page.getByText("It's a match!")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Fictional demo partner")).toBeVisible();

  // Skip to another partner
  const firstName = await page.getByRole("heading", { level: 2 }).first().textContent();
  await page.getByRole("button", { name: "Skip partner" }).click();
  await expect(page.getByText("It's a match!")).toBeVisible({ timeout: 15_000 });
  expect(await page.getByRole("heading", { level: 2 }).first().textContent()).not.toBe(firstName);

  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(page.getByText("Demo session")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Scripted demo partner — not a live person")).toBeVisible();

  // Mute toggles
  const mute = page.getByRole("button", { name: "Mute", exact: true });
  await mute.click();
  await expect(page.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");

  // Next scripted question
  const before = await page.getByLabel("Conversation").locator("> div").count();
  await page.getByRole("button", { name: /Next question from/ }).click();
  await expect(page.getByLabel("Conversation").locator("> div")).toHaveCount(before + 1);

  // Talk for a little over two minutes (fake clock), then end the call.
  await page.clock.runFor("02:10");
  await expect(page.getByText(/^02:1\d/)).toBeVisible();
  await page.getByRole("button", { name: "End call" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "End call" }).click();

  await expect(page.getByRole("heading", { name: "Conversation complete" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("7 days", { exact: true })).toBeVisible();
  await expect(page.getByText("Achievement unlocked: Seven-Day Streak")).toBeVisible();
  // Big moments get a celebration that the player dismisses.
  await page.getByRole("button", { name: "Awesome!" }).click();
  await expect(page.getByText("Not transcribed")).toBeVisible();

  await page.getByRole("link", { name: "Review session" }).click();
  await expect(page.getByText("No transcript for this session")).toBeVisible();

  await page.goto("/achievements");
  await expect(page.locator('[data-testid="achievement"][data-unlocked="true"]', { hasText: "Seven-Day Streak" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("ending a call within a minute saves an incomplete session without rewards", async ({ page }) => {
  await onboard(page, "Quick Exit");
  await page.goto("/free-talk");
  await page.getByRole("button", { name: "Start Matching" }).click();
  await page.getByRole("button", { name: "Start conversation" }).click({ timeout: 15_000 });
  await expect(page.getByText("Demo session")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "End call" }).click();
  await expect(page.getByRole("dialog")).toContainText("shorter than 1 minute");
  await page.getByRole("dialog").getByRole("button", { name: "End call" }).click();
  await expect(page.getByRole("heading", { name: "Conversation ended early" })).toBeVisible({ timeout: 15_000 });
  await page.goto("/history");
  await expect(page.locator('main a[href^="/history/"]').first()).toContainText("Incomplete");
  await page.goto("/dashboard");
  await expect(page.getByLabel(/0-day streak/).first()).toBeVisible();
});

test("reporting and blocking a partner records both and excludes them from matching", async ({ page }) => {
  await onboard(page, "Safety Tester");
  await page.goto("/free-talk");
  await page.getByRole("button", { name: "Start Matching" }).click();
  await page.getByRole("button", { name: "Start conversation" }).click({ timeout: 15_000 });
  await expect(page.getByText("Demo session")).toBeVisible({ timeout: 15_000 });
  const partner = (await page.locator("main p.text-lg.font-bold").first().textContent())!.trim();

  await page.getByRole("button", { name: "Report", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Submit report" }).click();
  await expect(dialog.getByText("Choose a reason for the report.")).toBeVisible();
  await dialog.getByRole("radio", { name: "Spam" }).click();
  await dialog.getByLabel("Details (optional)").fill("Kept sharing links.");
  await dialog.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByText("Report submitted")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conversation ended early" })).toBeVisible({ timeout: 15_000 });

  await page.goto("/safety");
  await expect(page.getByText(partner, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Kept sharing links.")).toBeVisible();

  // The blocked partner is never matched again.
  for (let i = 0; i < 5; i++) {
    const res = await page.request.post("/api/match", { data: { mode: "free_talk", proficiencyRange: ["beginner", "advanced"] } });
    expect((await res.json()).partner.displayName).not.toBe(partner);
  }
});
