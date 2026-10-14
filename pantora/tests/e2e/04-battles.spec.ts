import { expect, test } from "@playwright/test";
import { onboard, trackErrors } from "./helpers";

test("typed Speaking Battle produces a labeled simulated result", async ({ page }) => {
  const errors = trackErrors(page);
  await onboard(page, "Battle Typer");
  await page.goto("/battles?prompt=bp-ideal-weekend");
  await expect(page.getByRole("heading", { name: "Explain your ideal weekend in 30 seconds." })).toBeVisible();
  await page.getByRole("radio", { name: "None" }).click();
  await page.getByRole("radio", { name: /Type my answer/ }).click();
  await page.getByRole("button", { name: "Start this challenge" }).click();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
  await page.getByRole("button", { name: "Start speaking" }).click({ timeout: 15_000 });
  await page.getByLabel("Your answer").fill(
    "My ideal weekend starts with a slow breakfast with my family. After that, I go to the park because I love fresh air. For example, last weekend we had a picnic. In the evening I cook dinner for my friends.",
  );
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Simulated result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Both answers were scored as text/)).toBeVisible();
  await expect(page.getByText("Fluency and continuity").first()).toBeVisible();
  await expect(page.getByText(/Pronunciation is not scored/).first()).toBeVisible();
  await expect(page.getByText(/\+\d+ XP/).first()).toBeVisible();

  await page.getByRole("radio", { name: /'s sample/ }).click();
  await expect(page.getByText("Sample answer (pre-written)")).toBeVisible();

  await page.getByRole("link", { name: "Review in history" }).click();
  await expect(page.getByRole("heading", { name: "Battle result" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("recorded Speaking Battle uses the microphone and a typed transcript", async ({ page }) => {
  await onboard(page, "Battle Speaker");
  await page.goto("/battles");
  await page.getByRole("radio", { name: "None" }).click();
  await page.getByRole("button", { name: "Start a Practice Battle" }).click();
  await page.getByRole("button", { name: "Start speaking" }).click({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Recording", { exact: true })).toBeVisible();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByText(/Your recording · \d/)).toBeVisible();
  await expect(page.locator("audio[controls]")).toBeVisible();
  await page.getByLabel("What you said").fill("I think this topic is interesting because it changes how people live. For example, my friends talk about it a lot.");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Simulated result")).toBeVisible({ timeout: 20_000 });
});

test("resubmitting the same battle does not award XP twice", async ({ page }) => {
  await onboard(page, "Double Submit");
  const body = {
    idempotencyKey: "e2e-duplicate-battle-1",
    promptId: "bp-new-skill",
    opponentId: "demo-amara",
    prepSeconds: 30,
    speakSeconds: 30,
    response: "I would like to learn to cook because I want to eat healthier food.",
    inputMode: "typed",
    recordedSeconds: 0,
    startedAt: new Date(Date.now() - 60_000).toISOString(),
  };
  const first = await (await page.request.post("/api/battles", { data: body })).json();
  const second = await (await page.request.post("/api/battles", { data: body })).json();
  expect(first.duplicate).toBe(false);
  expect(first.rewards.xpTotal).toBeGreaterThan(0);
  expect(second.duplicate).toBe(true);
  expect(second.sessionId).toBe(first.sessionId);
  expect(second.rewards.xpTotal).toBe(0);
});
