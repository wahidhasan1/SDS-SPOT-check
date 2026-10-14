import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("live mode matches two people on the same server and connects audio", async ({ browser }) => {
  const a = await browser.newContext({ permissions: ["microphone"] });
  const b = await browser.newContext({ permissions: ["microphone"] });
  const pa = await a.newPage();
  const pb = await b.newPage();
  await onboard(pa, "Live Alice");
  await onboard(pb, "Live Bob");
  for (const p of [pa, pb]) {
    await p.goto("/free-talk");
    await p.getByRole("radio", { name: /Live/ }).click();
    await p.getByRole("button", { name: "Join the queue" }).click();
  }
  await expect(pa.getByText("Live Bob")).toBeVisible({ timeout: 20_000 });
  await expect(pb.getByText("Live Alice")).toBeVisible({ timeout: 20_000 });
  await expect(pa.getByText(/\d\d:\d\d \/ 0[5-9]:00|\d\d:\d\d \/ 1[05]:00/)).toBeVisible({ timeout: 20_000 });
  await pa.getByRole("button", { name: "End call" }).click();
  await pa.getByRole("dialog").getByRole("button", { name: "End call" }).click();
  await expect(pa.getByText("Call ended")).toBeVisible();
  await expect(pb.getByText("Call ended")).toBeVisible({ timeout: 15_000 });
  await a.close();
  await b.close();
});
