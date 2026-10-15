import { expect, test } from "@playwright/test";
import { onboard, trackErrors } from "./helpers";

test("battle types are browsable and a typed battle produces a labeled simulated result", async ({ page }) => {
  const errors = trackErrors(page);
  await onboard(page, "Battle Typer");
  await page.goto("/battles");
  await expect(page.getByRole("heading", { name: "Choose your battle" })).toBeVisible();
  await expect(page.locator("[data-mode]")).toHaveCount(6);

  // Open a battle type's details, then pick a specific prompt.
  await page.locator("[data-mode=quick-fire]").getByRole("link", { name: "Quick Fire", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quick Fire", level: 1 })).toBeVisible();
  await expect(page.getByText("How it works")).toBeVisible();
  await page.getByRole("radio", { name: /Explain your ideal weekend/ }).click();
  await expect(page.getByRole("heading", { name: "Explain your ideal weekend in 30 seconds." })).toBeVisible();
  await page.getByRole("radio", { name: /Type my answer/ }).click();
  await page.getByRole("button", { name: "Start battle" }).click();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
  await page.getByRole("button", { name: "Start preparation" }).click({ timeout: 15_000 });
  await expect(page.getByLabel(/seconds of preparation left/)).toBeVisible();
  await page.getByRole("button", { name: "I'm ready" }).click();
  await page.getByLabel("Your answer").fill(
    "My ideal weekend starts with a slow breakfast with my family. After that, I go to the park because I love fresh air. For example, last weekend we had a picnic. In the evening I cook dinner for my friends.",
  );
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Simulated result")).toBeVisible({ timeout: 20_000 });
  // First battle unlocks an achievement, which is celebrated.
  await expect(page.getByRole("dialog")).toContainText("First Speaking Battle");
  await page.getByRole("button", { name: "Awesome!" }).click();
  await expect(page.getByText(/Both answers were scored as text/)).toBeVisible();
  await expect(page.getByText("Fluency and continuity").first()).toBeVisible();
  await expect(page.getByText(/Pronunciation is not scored/).first()).toBeVisible();
  await expect(page.getByText("Finished a Quick Fire battle")).toBeVisible();
  await expect(page.getByText(/\+\d+ XP/).first()).toBeVisible();
  await expect(page.getByText("Round by round")).toBeVisible();

  await page.getByRole("radio", { name: /'s sample/ }).click();
  await expect(page.getByText("Sample answer (pre-written)")).toBeVisible();

  await page.getByRole("link", { name: "Review in history" }).click();
  await expect(page.getByRole("heading", { name: "Battle result" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Daily Challenge starts straight from the dashboard and pays its bonus once", async ({ page }) => {
  await onboard(page, "Daily Player");
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Accept challenge" }).click();
  await expect(page.getByText("Finding an opponent…")).toBeVisible();
  await page.getByRole("radio", { name: /Type my answer/ }).click({ timeout: 15_000 });
  await expect(page.getByText(/Daily Challenge \+20 XP/)).toBeVisible();
  await page.getByRole("button", { name: "Start preparation" }).click();
  await page.getByRole("button", { name: "I'm ready" }).click();
  await page.getByLabel("Your answer").fill("I think it is a really interesting question because it changes how people live. For example, my friends talk about it a lot.");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Simulated result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Completed the Daily Challenge")).toBeVisible();
  await page.getByRole("button", { name: "Awesome!" }).click();

  await page.goto("/dashboard");
  await expect(page.getByText("Completed today")).toBeVisible();
});

test("recorded Speaking Battle uses the microphone and a typed transcript", async ({ page }) => {
  await onboard(page, "Battle Speaker");
  await page.goto("/battles?mode=free-play");
  await page.getByRole("radio", { name: "None" }).click();
  await page.getByRole("button", { name: "Start battle" }).click();
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
    prepSeconds: 10,
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
  expect(first.rewards.xpItems[0].amount).toBe(30);
  expect(second.duplicate).toBe(true);
  expect(second.sessionId).toBe(first.sessionId);
  expect(second.rewards.xpTotal).toBe(0);
});

test("weekly quests can be claimed once, and reward avatars stay locked", async ({ page }) => {
  await onboard(page, "Quest Runner");
  for (const [i, promptId] of ["bp-new-skill", "bp-ideal-weekend", "bp-morning-person"].entries()) {
    const res = await page.request.post("/api/battles", {
      data: { idempotencyKey: `e2e-quest-${i}`, promptId, opponentId: "demo-amara", prepSeconds: 10, speakSeconds: 30, response: "I like it because it is fun. For example, I do it every week.", inputMode: "typed", recordedSeconds: 0, startedAt: new Date(Date.now() - 60_000).toISOString() },
    });
    expect(res.ok()).toBeTruthy();
  }
  await page.goto("/achievements");
  const quest = page.getByTestId("quest").filter({ hasText: "Battle Royale" });
  await quest.getByRole("button", { name: /Claim 40 XP/ }).click();
  await expect(page.getByRole("dialog")).toContainText("+40 XP");
  await page.getByRole("button", { name: "Awesome!" }).click();
  await expect(quest.getByText("Claimed · +40 XP")).toBeVisible();
  const again = await page.request.post("/api/quests/battle-royale/claim", { data: {} });
  expect(again.status()).toBe(400);

  await expect(page.getByText("Demo league: other players are fictional")).toBeVisible();
  await expect(page.getByRole("button", { name: "Equip" })).toHaveCount(0);
  const locked = await page.request.patch("/api/settings", {
    data: { profile: { displayName: "Quest Runner", avatar: "legend", proficiency: "intermediate", goals: ["fluency"], dailyGoalMinutes: 10, conversationPref: "both" } },
  });
  expect(locked.status()).toBe(400);
});
