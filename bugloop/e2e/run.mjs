// End-to-end check of the whole QA ↔ engineering loop, driven through the real UI.
//
//   npm run build:demo && npm run e2e                 # against the single-file demo (no server)
//   BASE=http://localhost:3000 npm run e2e            # against a running server with sample data
//
// Wahid reports a bug with the assistant, the module owner asks a question, Wahid answers, the
// engineer fixes it, Wahid fails the regression, it is fixed again, Wahid verifies it and it closes.
// Then every main page is checked for console errors and for horizontal overflow on a phone.
// Screenshots land in e2e/output/. Set CHROMIUM_PATH to use a specific browser binary.

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? null;
const DEMO = pathToFileURL(resolve("dist/demo/index.html")).href;
const OUT = resolve("e2e/output");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
let checks = 0;
function expect(cond, message) {
  checks++;
  if (!cond) {
    failures.push(message);
    console.log(`  ✗ ${message}`);
  }
}
const step = (s) => console.log(`• ${s}`);

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // Web fonts may be unreachable in sandboxes; that's not an app error.
    if (m.type() === "error" && !/fonts\.g|ERR_CERT|ERR_NAME|ERR_INTERNET|ERR_CONNECTION/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function start(context) {
  const page = await context.newPage();
  const errors = watchErrors(page);
  if (BASE) {
    await page.goto(BASE);
    await page.evaluate(async () => {
      const status = await (await fetch("/api/auth/status")).json();
      const wahid = status.demo_accounts.find((a) => a.name === "Wahid Hasan");
      if (!wahid) throw new Error("The server has no demo sign-in for Wahid Hasan (seed sample data first).");
      const res = await (await fetch("/api/auth/demo-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user_id: wahid.id }) })).json();
      localStorage.setItem("bugloop.session", res.token);
    });
    await page.goto(BASE);
  } else {
    await page.goto(DEMO);
  }
  await page.waitForSelector("text=Where every bug is", { timeout: 30_000 });
  return { page, errors };
}

// ---------------------------------------------------------------------------------------------
// The lifecycle
// ---------------------------------------------------------------------------------------------

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const { page, errors } = await start(desktop);
const rail = () => page.locator(".bug-rail");
const nav = (name) => page.locator(".nav").getByRole("link", { name });

async function switchTo(name) {
  await page.locator(".sidebar-foot .list-row").click();
  await page.getByRole("button", { name: "Switch person", exact: true }).click();
  await page.locator(".persona", { hasText: name }).first().click();
  await page.waitForSelector(`.sidebar-foot >> text=${name}`, { timeout: 10_000 });
}
async function openBug(key) {
  await page.getByLabel("Search bugs").fill(key);
  await page.waitForTimeout(400);
  await page.getByLabel("Search bugs").press("Enter");
  await page.waitForSelector(`.bug-key >> text=${key}`, { timeout: 10_000 });
}
const status = async () => (await page.locator(".bug-badges .pill").first().textContent()).trim();
async function act(label, fields = {}, submit) {
  await rail().getByRole("button", { name: label, exact: true }).click();
  if (submit) {
    const dialog = page.locator(".dialog");
    await dialog.waitFor();
    for (const [id, value] of Object.entries(fields)) {
      const el = page.locator(`#${id}`);
      if (value === true) await el.check();
      else await el.fill(value);
    }
    await dialog.getByRole("button", { name: submit, exact: true }).click();
    await dialog.waitFor({ state: "detached", timeout: 10_000 });
  }
  await page.waitForTimeout(400);
}

step("Wahid reports a bug with the assistant");
await page.getByRole("button", { name: /Report bug/ }).first().click();
await page
  .locator("textarea[aria-label='Describe the problem in your own words']")
  .fill("In Members > Edit member, when I change the phone number and click Save it shows Saved, but after reloading the page the old phone number is back. Happens every time on Staging in Chrome.");
await page.getByLabel("Module").selectOption({ label: "Members" });
await page.getByRole("button", { name: /Draft report/ }).click();
await page.waitForSelector(".draft-summary", { timeout: 60_000 });
expect((await page.locator("#r-title").inputValue()).length > 10, "the assistant drafts a title");
expect((await page.locator(".steps-editor input").count()) >= 2, "the assistant drafts steps");
if (!(await page.locator("#r-expected").inputValue())) await page.locator("#r-expected").fill("The new phone number is kept after reloading.");
await page.getByLabel("Severity").selectOption({ label: "Minor" });
const confirm = page.getByRole("button", { name: "They're correct" });
if (await confirm.count()) await confirm.click();
await page.getByRole("button", { name: "Submit report" }).click();
await page.waitForTimeout(600);
if (await page.locator(".dialog").count()) await page.getByRole("button", { name: /different problem/ }).click();
await page.waitForSelector(".bug-title", { timeout: 10_000 });
const key = (await page.locator(".bug-key").textContent()).trim();
expect(/^[A-Z]{2,6}-\d{6}$/.test(key), `the new bug has an ID (${key})`);
expect((await status()) === "New", "a new report starts as New");

step(`Rafiq, owner of Members, asks a question on ${key}`);
await switchTo("Rafiq Chowdhury");
await openBug(key);
await act("Request information", { "act-request_info-question": "Which member did you edit, and was the number in +47 format?" }, "Send question");
expect((await status()) === "Need More Information", "requesting information moves it to Need More Information");

step("Wahid answers from his queue");
await switchTo("Wahid Hasan");
await nav(/Needs my action/).click();
await page.locator(".list-row", { hasText: key }).click();
await page.waitForSelector(".bug-title");
await act("Provide information", { "act-provide_info-answer": "Member Kari Nordmann. Yes, +47 912 34 567." }, "Send answer");
expect((await status()) === "New", "answering returns it to where it was");

step("Rafiq starts work and fixes it");
await switchTo("Rafiq Chowdhury");
await openBug(key);
await act("Start work");
expect((await status()) === "In Progress", "start work → In Progress");
await act(
  "Mark fixed",
  { "act-mark_fixed-resolution": "The phone field was missing from the update payload.", "act-mark_fixed-fix_version": "2.14.3", "act-mark_fixed-available_now": true },
  "Mark fixed",
);
expect((await status()) === "Regression Required", "a testable fix goes straight to Regression Required");
expect((await rail().getByRole("button", { name: "Close", exact: true }).count()) === 0, "engineers cannot close a fixed bug");

step("Wahid fails the regression");
await switchTo("Wahid Hasan");
await nav(/^Regression/).click();
await page.locator(".list-row", { hasText: key }).click();
await page.waitForSelector(".bug-title");
await act("Fail regression", { "act-fail_regression-details": "Still reverts when the number has spaces." }, "Fail and reopen");
expect((await status()) === "Reopened", "a failed regression reopens the bug");

step("Rafiq fixes it again; Wahid verifies");
await switchTo("Rafiq Chowdhury");
await openBug(key);
await act("Mark fixed", { "act-mark_fixed-resolution": "Normalise spaces before saving.", "act-mark_fixed-fix_version": "2.14.4", "act-mark_fixed-available_now": true }, "Mark fixed");
await switchTo("Wahid Hasan");
await openBug(key);
await act("Pass regression", { "act-pass_regression-notes": "Checked with and without spaces." }, "Verify fix");
expect((await status()) === "Closed", "verifying closes the bug (auto-close on)");
const timeline = (await page.locator(".tl-item").allTextContents()).join("\n");
for (const phrase of ["reported this bug", "requested more information", "provided the requested information", "failed the regression", "verified the fix", "Closed automatically after verification"]) {
  expect(timeline.includes(phrase), `the timeline records “${phrase}”`);
}
await page.screenshot({ path: `${OUT}/lifecycle-closed.png`, fullPage: true });

step("Notifications");
await nav(/^Notifications/).click();
await page.waitForSelector(".notif");
const wahidNotes = (await page.locator(".notif-title").allTextContents()).join("\n");
expect(wahidNotes.includes(`${key} has been marked Fixed. Regression testing required.`), "QA is told the fix needs regression");
await switchTo("Rafiq Chowdhury");
await nav(/^Notifications/).click();
await page.waitForSelector(".notif");
const rafiqNotes = (await page.locator(".notif-title").allTextContents()).join("\n");
expect(rafiqNotes.includes(`QA reopened ${key} after failed regression.`), "engineering is told about the reopen");
expect(rafiqNotes.includes(`New bug ${key} has been assigned to you.`), "the module owner is told about the new bug");
expect(errors.length === 0, `no console errors during the lifecycle${errors.length ? `: ${errors.join(" | ")}` : ""}`);

// ---------------------------------------------------------------------------------------------
// Every page renders, and nothing scrolls sideways on a phone
// ---------------------------------------------------------------------------------------------

step("Pages at phone width");
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const { page: mp, errors: mErrors } = await start(phone);
async function noOverflow(label) {
  await mp.waitForTimeout(400);
  const widths = await mp.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(widths[0] <= widths[1], `${label}: no horizontal scroll at 390px (${widths[0]} > ${widths[1]})`);
  await mp.screenshot({ path: `${OUT}/phone-${label.replace(/\W+/g, "-").toLowerCase()}.png` });
}
await noOverflow("dashboard");
for (const [label, link] of [
  ["needs my action", /Needs my action/],
  ["bugs", /^Bugs$/],
  ["regression", /^Regression/],
  ["notifications", /^Notifications/],
  ["analytics", /^Analytics/],
  ["projects", /^Projects/],
]) {
  await mp.getByLabel("Open navigation").click();
  await mp.waitForTimeout(250);
  await mp.locator(".nav").getByRole("link", { name: link }).click();
  await noOverflow(label);
}
await mp.getByLabel("Search bugs").fill("BUG-000124");
await mp.waitForTimeout(400);
await mp.getByLabel("Search bugs").press("Enter");
await mp.waitForSelector(".bug-title");
await noOverflow("bug detail");
await mp.getByRole("button", { name: /Report$/ }).click();
await mp.waitForSelector("text=Describe what happened");
await noOverflow("report bug");
expect(mErrors.length === 0, `no console errors on phone pages${mErrors.length ? `: ${mErrors.join(" | ")}` : ""}`);

await browser.close();
console.log(`\n${checks - failures.length}/${checks} checks passed${failures.length ? `; ${failures.length} failed` : ""}. Screenshots: e2e/output/`);
process.exit(failures.length ? 1 : 0);
