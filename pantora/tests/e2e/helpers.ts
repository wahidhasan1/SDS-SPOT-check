import { expect, type Page } from "@playwright/test";

export async function signInDemo(page: Page) {
  const res = await page.request.post("/api/demo/start", { data: {} });
  expect(res.ok()).toBeTruthy();
}

export async function onboard(page: Page, name: string) {
  const res = await page.request.post("/api/onboarding", {
    data: { displayName: name, avatar: "sky", proficiency: "intermediate", goals: ["fluency"], conversationPref: "both", dailyGoalMinutes: 10, timezone: "UTC" },
  });
  expect(res.status()).toBe(201);
}

/** Fails the test on uncaught page errors. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
