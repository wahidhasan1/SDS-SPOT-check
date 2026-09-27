// Hand-written demo stories. Each exercises a workflow or edge case from the product brief;
// several use the exact bug numbers from the brief's examples.

import type { OrgEvent, Scenario, TimeHelpers } from "./script";
import type { ShotSpec } from "./screenshots";

export const HUB_NAV = ["CRM", "Sales", "Support", "Meetings", "Ledger", "Stride", "Quality"];
export const SDS_NAV = ["Dashboard", "SDS Hub", "Members", "Sites", "Reports", "Settings"];
export const EHS_NAV = ["Incidents", "Risk assessments", "Audits"];
export const SUP_NAV = ["Documents", "Products", "Account"];

type Rest = Omit<ShotSpec, "app" | "nav" | "active">;
const hub = (active: string, rest: Rest): ShotSpec => ({ app: "HUB ONE", nav: HUB_NAV, active, ...rest });
const sds = (active: string, rest: Rest): ShotSpec => ({ app: "SDS ONE", nav: SDS_NAV, active, ...rest });
const ehs = (active: string, rest: Rest): ShotSpec => ({ app: "EHS", nav: EHS_NAV, active, ...rest });
const mob = (rest: Omit<ShotSpec, "app" | "nav" | "active" | "mobile">): ShotSpec => ({ app: "SDS ONE", nav: [], active: "", mobile: true, ...rest });
const sup = (active: string, rest: Rest): ShotSpec => ({ app: "SDS ONE Supplier portal", nav: SUP_NAV, active, ...rest });

export function orgEvents(t: TimeHelpers): OrgEvent[] {
  return [
    { at: t.day(35, "09:00"), kind: "change_team", who: "erik", team: "mobile", by: "mahmud" },
    { at: t.day(20, "16:00"), kind: "deactivate", who: "farhan", by: "mahmud" },
    { at: t.day(9, "17:10"), kind: "deactivate", who: "jakob", by: "mahmud" },
  ];
}

export function showcaseScenarios(t: TimeHelpers): Scenario[] {
  const d = t.day;
  return [
    // Forced close: the feature was removed, nothing left to verify.
    {
      handle: "legacyImporter",
      created: d(70, "09:30"),
      report: {
        by: "ingrid", project: "sds", module: "supplier", feature: "Bulk upload",
        title: "Legacy importer crashes on files exported in 2019",
        description: "The legacy importer stops with an error for supplier files exported from the 2019 system.",
        steps: ["Open Documents › Legacy import", "Choose a 2019 export file (products_2019.xml)", "Click Import"],
        expected: "Products from the file are imported.",
        actual: "'Import failed: unexpected element <prodGroup>' and nothing is imported.",
        severity: "major", env: "Staging", browser: "Chrome 127", frequency: "always",
      },
      steps: [
        { at: d(69, "10:15"), as: "imran", action: "start_review" },
        { at: d(69, "10:40"), as: "imran", comment: "The legacy importer is scheduled for removal in 2.14. Checking with product whether we still need it." },
        { at: d(40, "15:00"), as: "nusrat", action: "force_close", input: { reason: "The legacy importer was removed in 2.14 and suppliers now use bulk upload. Nothing left to verify." } },
      ],
    },

    // Severity raised after the fix, with a reason (edge case).
    {
      handle: "auditTabs",
      created: d(62, "10:30"),
      report: {
        by: "tanvir", project: "ehs", module: "audits", feature: "Audits",
        title: "Audit checklist loses answers when switching between tabs",
        description: "Answers on one tab of an audit checklist are cleared after visiting another tab.",
        steps: ["Start the 'Warehouse storage' audit", "Answer the questions on the Storage tab", "Switch to the Labelling tab", "Switch back to Storage"],
        expected: "The Storage answers are still there.",
        actual: "All answers on the Storage tab are empty.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 127", frequency: "always",
      },
      steps: [
        { at: d(61, "09:10"), as: "imran", action: "start_work" },
        { at: d(58, "16:30"), as: "imran", action: "mark_fixed", input: { resolution: "Tab contents are no longer unmounted, so unsaved answers are kept.", fix_version: "2.12.0", root_cause: "frontend" } },
        { at: d(57, "10:20"), as: "tanvir", action: "pass_regression", input: { notes: "Switched tabs 10 times on two audits; answers kept." } },
        { at: d(20, "11:00"), as: "nusrat", severity: "critical", reason: "Customer escalation: three audits lost answers before the fix. Recording it as critical for the quarterly quality review." },
      ],
    },

    // Dispute upheld by a PM; the decision is final.
    {
      handle: "resetExpiry",
      created: d(48, "10:00"),
      report: {
        by: "sadia", project: "sds", module: "mobile", feature: "Password reset",
        title: "Password reset link expires after 15 minutes",
        description: "Reset links stop working after 15 minutes, which is too short for many users.",
        steps: ["Request a password reset in the app", "Open the email 20 minutes later", "Tap the reset link"],
        expected: "The link works for at least 24 hours.",
        actual: "'This link has expired' is shown.",
        severity: "minor", device: "iPhone 15", os: "iOS 17.5", version: "3.6.4", frequency: "always",
      },
      steps: [
        { at: d(47, "11:00"), as: "kamal", action: "mark_not_a_bug", input: { category: "works_as_designed", reason: "Reset links expire after 15 minutes by security policy (access control requirement A.9.4)." } },
        { at: d(47, "13:30"), as: "sadia", action: "dispute", input: { reason: "Our users often read emails much later. The 15-minute limit causes support tickets every week." } },
        { at: d(46, "10:15"), as: "jonas", action: "uphold_decision", input: { note: "The security requirement stands. We'll change the email text to mention the 15-minute limit instead (tracked separately)." } },
        { at: d(46, "11:00"), as: "sadia", action: "accept_decision" },
      ],
    },

    // Engineer changed teams; ownership moved with a clear history.
    {
      handle: "auditDateFormat",
      created: d(45, "10:00"),
      report: {
        by: "wahid", project: "sds", module: "settings", feature: "Language",
        title: "Register export uses American dates for Norwegian companies",
        description: "The exported chemical register shows dates as MM/DD/YYYY even when the company language is Norwegian.",
        steps: ["Set Settings › Language to Norsk", "Open Reports › Chemical register and export it", "Check the dates in the export"],
        expected: "Dates use DD.MM.YYYY.",
        actual: "Dates are shown as 08/14/2026.",
        severity: "minor", env: "QA", browser: "Chrome 127", frequency: "always", tags: ["dates", "localization"],
      },
      steps: [
        { at: d(44, "09:30"), as: "lars", assign: "erik" },
        { at: d(43, "14:00"), as: "erik", action: "start_work" },
        { at: d(40, "11:20"), as: "erik", comment: "The export service formats dates on the server without the company locale. Fix is half done on branch fix/register-date-locale." },
        { at: d(34, "10:05"), as: "lars", assign: "maria" },
        { at: d(34, "10:07"), as: "lars", comment: "Erik moved to the mobile team; Maria is taking over from his branch." },
        { at: d(31, "15:30"), as: "maria", action: "mark_fixed", input: { resolution: "Export service now formats dates with the company locale (finished Erik's branch).", fix_version: "2.13.2", root_cause: "backend" } },
        { at: d(30, "10:40"), as: "wahid", action: "pass_regression", input: { notes: "Checked Norwegian and English companies." } },
      ],
    },

    // Archived by mistake-proof deletion.
    {
      handle: "testBug",
      created: d(44, "16:05"),
      report: {
        by: "tanvir", project: "sds", module: "dashboard",
        title: "test please ignore",
        description: "Testing the report form.",
        steps: ["test"], expected: "test", actual: "test", severity: "trivial",
      },
      steps: [{ at: d(44, "16:20"), as: "nusrat", action: "archive", input: { reason: "Created by mistake during onboarding training." } }],
    },

    // Deferred with a revisit date that has now passed (PM action item).
    {
      handle: "kpiSiteFilter",
      created: d(41, "11:00"),
      report: {
        by: "tanvir", project: "sds", module: "dashboard", feature: "KPIs",
        title: "Dashboard KPI tiles ignore the site filter",
        description: "Choosing a site on the Dashboard doesn't change the KPI tiles.",
        steps: ["Open the Dashboard", "Choose the site filter 'Bergen'", "Look at the KPI tiles"],
        expected: "KPIs show numbers for Bergen only.",
        actual: "KPIs keep showing company-wide numbers.",
        severity: "minor", env: "Staging", browser: "Firefox 129", frequency: "always",
      },
      steps: [
        { at: d(40, "10:00"), as: "lars", action: "start_review" },
        {
          at: d(38, "14:20"), as: "hanne", action: "defer",
          input: {
            reason: "KPI tiles are being rebuilt in the dashboard redesign. Fixing the old tiles now would be thrown away.",
            target: "Dashboard redesign",
            revisit_on: new Date(t.now.getTime() - 3 * 86_400_000).toISOString().slice(0, 10),
          },
        },
        { at: d(37, "09:00"), as: "tanvir", action: "accept_decision" },
      ],
    },

    // Reopened three times; escalation to the QA lead and PM; collaborator added.
    {
      handle: "syncDupes",
      created: d(33, "13:20"),
      report: {
        by: "ingrid", project: "sds", module: "mobile", feature: "Sync",
        title: "Offline stock updates are applied twice after sync",
        description: "A stock change made offline is applied twice when the phone reconnects.",
        steps: ["Turn on airplane mode", "Update stock for 'Aceton 1 L' from 10 to 8", "Turn off airplane mode and wait for sync", "Check the stock on the web"],
        expected: "Stock is 8 on the phone and on the web.",
        actual: "Stock is 6 on the web: the update was applied twice.",
        severity: "critical", priority: "high", device: "Galaxy S23", os: "Android 14", version: "3.7.0", frequency: "always",
        tags: ["offline", "data-integrity"],
        files: [{ kind: "shot", name: "stock-web-vs-phone.png", shot: mob({ crumbs: ["Inventory", "Aceton 1 L"], heading: "Aceton 1 L", fields: [{ label: "Stock on phone", value: "8 L" }, { label: "Stock on web (after sync)", value: "6 L", mark: true }], note: "Applied twice" }) }],
      },
      steps: [
        { at: d(32, "09:30"), as: "kamal", action: "start_work" },
        { at: d(28, "16:00"), as: "kamal", action: "mark_fixed", input: { resolution: "Sync requests now carry an idempotency key.", fix_version: "3.7.1", root_cause: "backend" } },
        { at: d(27, "11:00"), as: "ingrid", action: "fail_regression", input: { details: "Fixed for single updates, but two updates to the same product while offline are still applied twice.", build: "3.7.1" } },
        { at: d(26, "10:00"), as: "kamal", action: "start_work" },
        { at: d(20, "15:00"), as: "kamal", action: "mark_fixed", input: { resolution: "Idempotency key now includes each change's sequence number.", fix_version: "3.7.2", root_cause: "backend" } },
        { at: d(19, "13:30"), as: "ingrid", action: "fail_regression", input: { details: "Works on Android now. On iOS the second update is still duplicated if the app was in the background during sync.", build: "3.7.2" } },
        { at: d(18, "09:00"), as: "kamal", action: "start_work" },
        { at: d(17, "10:00"), as: "sofie", collaborators: ["sofie"] },
        { at: d(17, "10:05"), as: "sofie", comment: "Joining to look at the iOS background task side." },
        { at: d(6, "17:00"), as: "kamal", action: "mark_fixed", input: { resolution: "iOS background task now flushes the outbox exactly once.", fix_version: "3.8.0-beta.2", root_cause: "frontend" } },
        { at: d(5, "14:30"), as: "ingrid", action: "fail_regression", input: { details: "Still duplicated if the app is killed while syncing (iOS 17.5, iPhone 14).", build: "3.8.0-beta.2" } },
        { at: d(4, "09:30"), as: "kamal", action: "start_work" },
      ],
    },

    // Reporter left the company: regression goes to the QA lead; credit stays with the reporter.
    {
      handle: "revisionNumberPdf",
      created: d(30, "14:00"),
      report: {
        by: "farhan", project: "ehs", module: "risk", feature: "Risk assessments",
        title: "Risk assessment PDF shows the previous revision number",
        description: "After revising an approved risk assessment, the PDF header still shows the old revision number.",
        steps: ["Open an approved risk assessment", "Click Revise and approve the new revision (revision 3)", "Export it to PDF"],
        expected: "The PDF header says Revision 3.",
        actual: "The PDF header says Revision 2.",
        severity: "major", env: "Staging", browser: "Chrome 127", frequency: "always",
      },
      steps: [
        { at: d(29, "10:00"), as: "imran", action: "start_work" },
        { at: d(20, "16:30"), as: "nusrat", comment: "Farhan has left the company. I'll handle the regression testing for his open reports." },
        { at: d(1, "14:20"), as: "imran", action: "mark_fixed", input: { resolution: "The PDF header now reads the revision from the assessment instead of the template.", fix_version: "2.14.2", root_cause: "backend" } },
      ],
    },

    // BUG-000087: the existing report the brief's duplicate check finds.
    {
      handle: "ownerNotSaved",
      number: 87,
      created: d(27, "11:20"),
      report: {
        by: "tanvir", project: "hub", module: "crm", feature: "Contacts",
        title: "Contact owner changes are not saved",
        description: "Changing a contact's owner shows 'Contact updated', but the old owner is back when the contact is opened again.",
        steps: ["Go to CRM › Contacts", "Open an existing contact (for example Karim Ahmed at Delta Traders Ltd)", "Change Owner from Sadia Rahman to Tanvir Ahmed", "Click Save", "Close the contact and open it again"],
        expected: "The contact keeps Tanvir Ahmed as owner.",
        actual: "'Contact updated' is shown, but the owner is Sadia Rahman again after reopening.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["ownership"],
        files: [
          {
            kind: "shot", name: "contact-owner-after-reopen.png",
            shot: hub("CRM", { crumbs: ["CRM", "Contacts", "Karim Ahmed"], heading: "Karim Ahmed", fields: [{ label: "Company", value: "Delta Traders Ltd" }, { label: "Owner", value: "Sadia Rahman", mark: true }, { label: "Lifecycle stage", value: "Customer" }], toast: { tone: "success", text: "Contact updated" }, note: "Changed to Tanvir, still Sadia" }),
          },
        ],
      },
      steps: [
        { at: d(26, "09:05"), as: "rafiq", action: "start_review" },
        { at: d(26, "09:40"), as: "rafiq", action: "request_info", input: { question: "Is this for every owner change or only between these two people? Does a hard refresh make a difference?" } },
        {
          at: d(26, "13:15"), as: "tanvir", action: "provide_info",
          input: { answer: "Every change I tried (Sadia → Tanvir and Tanvir → Wahid). A hard refresh doesn't help. Network log attached." },
          files: [{ kind: "log", name: "network-log.txt", text: "PATCH /api/crm/contacts/2231  200  12 ms\nrequest body: {\"name\":\"Karim Ahmed\",\"owner_id\":\"usr_sadia\",\"company_id\":\"cmp_delta\"}\nGET /api/crm/contacts/2231  200\nresponse: {\"owner_id\":\"usr_sadia\"}\n" }],
        },
        { at: d(25, "10:30"), as: "rafiq", action: "start_work" },
        { at: d(24, "15:10"), as: "rafiq", comment: "Found it: the owner dropdown updates local state, but the PATCH body is built from the original contact object (see the log: owner_id is still Sadia). The fix depends on the contacts API change planned for 4.15." },
        { at: d(12, "10:00"), as: "jonas", priority: "urgent", reason: "Three sales teams escalated this week: leads are followed up by the wrong person." },
        { at: d(3, "16:20"), as: "sadia", alsoSeen: "Same with the Account manager field on companies." },
      ],
    },

    // Assigned to an engineer who has since left (lead action: reassign).
    {
      handle: "jakobOrphan",
      created: d(22, "13:00"),
      report: {
        by: "wahid", project: "sds", module: "dashboard", feature: "Widgets",
        title: "Rearranged dashboard widgets go back to the default order",
        description: "The new widget order is lost after logging out.",
        steps: ["Drag the Incidents widget to the top of the Dashboard", "Log out and log in again"],
        expected: "Widgets keep the order I set.",
        actual: "Widgets are back in the default order.",
        severity: "minor", env: "QA", browser: "Chrome 128", frequency: "always",
      },
      steps: [
        { at: d(21, "10:00"), as: "lars", assign: "jakob" },
        { at: d(20, "11:15"), as: "jakob", action: "start_work" },
        { at: d(18, "16:40"), as: "jakob", comment: "Order is saved in local storage only. Moving it to the user profile API." },
      ],
    },

    // BUG-000102: the original that BUG-000119 duplicates.
    {
      handle: "leadNoEmail",
      number: 102,
      created: d(20, "10:05"),
      report: {
        by: "sadia", project: "hub", module: "crm", feature: "Leads",
        title: "Web-to-lead form accepts leads without an email address",
        description: "Leads can be created from the website contact form with an empty email, so sales can't follow them up.",
        steps: ["Open the public contact form (hubone.example.com/contact)", "Fill in name and company, leave Email empty", "Click Send", "Open CRM › Leads"],
        expected: "The form asks for an email address.",
        actual: "The lead is created with an empty email and assigned to a sales rep.",
        severity: "major", env: "QA", browser: "Chrome 128", frequency: "always", tags: ["validation"],
      },
      steps: [
        { at: d(19, "09:10"), as: "rafiq", assign: "tahmid" },
        { at: d(19, "09:30"), as: "tahmid", action: "start_work" },
        { at: d(9, "11:00"), as: "tahmid", comment: "Server-side validation is missing too. Adding both, plus a test." },
      ],
    },

    // Also seen: co-reporter with extra evidence.
    {
      handle: "sessionIncident",
      created: d(19, "11:30"),
      report: {
        by: "tanvir", project: "ehs", module: "incidents", feature: "Incident reports",
        title: "Session expires while filling in a long incident report",
        description: "Long incident reports are lost because the session expires without warning.",
        steps: ["Start a new incident report", "Spend about 40 minutes filling in the form", "Click Submit"],
        expected: "The report is submitted, or I'm warned before the session expires.",
        actual: "The login page appears and everything typed is lost.",
        severity: "major", env: "Production", browser: "Edge 128", frequency: "always", tags: ["session"],
      },
      steps: [
        { at: d(18, "10:00"), as: "imran", action: "start_review" },
        {
          at: d(15, "14:00"), as: "wahid", alsoSeen: "Same for risk assessments: I lost 20 minutes of work today.",
          files: [{ kind: "shot", name: "session-expired.png", shot: ehs("Risk assessments", { crumbs: ["Risk assessments", "New"], heading: "Session expired", banner: { tone: "warning", text: "Your session has expired. Please log in again." }, note: "Form content lost" }) }],
        },
        { at: d(14, "09:15"), as: "imran", action: "start_work" },
      ],
    },

    // BUG-000104: failed regression once, fixed again, regression required now.
    {
      handle: "lastActivity",
      number: 104,
      created: d(18, "13:45"),
      report: {
        by: "wahid", project: "hub", module: "crm", feature: "Activities",
        title: "Last activity date not updated after logging a call",
        description: "Logging a call on a contact keeps the old 'Last activity' date on the contact.",
        steps: ["Open a contact in CRM (for example 'Nabila Chowdhury')", "Click Log activity › Call", "Save the call with today's date (02.09.2026)", "Look at Last activity on the contact"],
        expected: "Last activity shows 02.09.2026.",
        actual: "Last activity still shows 14.03.2026.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["activities"],
        files: [{ kind: "shot", name: "last-activity.png", shot: hub("CRM", { crumbs: ["CRM", "Contacts", "Nabila Chowdhury"], heading: "Nabila Chowdhury", fields: [{ label: "Company", value: "Rupali Foods" }, { label: "Last activity", value: "14.03.2026", mark: true }, { label: "Owner", value: "Wahid Hasan" }], toast: { tone: "success", text: "Call logged" } }) }],
      },
      steps: [
        { at: d(17, "10:00"), as: "rafiq", assign: "sabrina" },
        { at: d(17, "10:10"), as: "sabrina", action: "start_work" },
        { at: d(11, "15:30"), as: "sabrina", action: "mark_fixed", input: { resolution: "Logging a call now updates the contact's last activity date.", fix_version: "4.14.1", root_cause: "backend" } },
        { at: d(10, "11:20"), as: "wahid", action: "start_regression" },
        {
          at: d(10, "14:05"), as: "wahid", action: "fail_regression",
          input: { details: "Works for calls logged on the contact page, but meetings booked through Meetings still leave the old date.", build: "4.14.1" },
          files: [{ kind: "shot", name: "last-activity-meeting.png", shot: hub("Meetings", { crumbs: ["Meetings", "Intro call – Rupali Foods"], heading: "Nabila Chowdhury", fields: [{ label: "Meeting held", value: "02.09.2026" }, { label: "Last activity (CRM)", value: "14.03.2026", mark: true }] }) }],
        },
        { at: d(9, "09:15"), as: "sabrina", action: "start_work" },
        { at: d(1, "15:40"), as: "sabrina", action: "mark_fixed", input: { resolution: "Meetings now update the contact's last activity through the same event as calls.", fix_version: "4.14.2", root_cause: "backend" } },
      ],
    },

    // BUG-000108: AI-assisted report; engineer waiting for information from QA.
    {
      handle: "noteAttachments",
      number: 108,
      created: d(16, "09:50"),
      report: {
        by: "wahid", project: "hub", module: "crm", feature: "Companies",
        title: "Attachments disappear from a company note saved as a draft",
        description: "Files added to a new note on a company are gone after saving the note as a draft and opening it again.",
        steps: ["Go to CRM › Companies", "Open 'Delta Traders Ltd' and click Add note", "Attach two files (contract.pdf and price-list.xlsx)", "Click Save as draft", "Open the draft note again"],
        expected: "The two files are still attached to the draft.",
        actual: "The draft opens with 'No attachments', although 'Draft saved' was shown.",
        severity: "major", env: "QA", browser: "Edge 128", frequency: "always",
        files: [{ kind: "shot", name: "draft-attachments.png", shot: hub("CRM", { crumbs: ["CRM", "Companies", "Delta Traders Ltd", "Draft note"], heading: "Renewal terms 2027", fields: [{ label: "Company", value: "Delta Traders Ltd" }, { label: "Attachments", value: "No attachments", mark: true }], toast: { tone: "success", text: "Draft saved" } }) }],
        ai: {
          provider: "anthropic",
          model: "claude-opus-5",
          drafted_fields: ["title", "description", "steps", "expected_result", "actual_result"],
          provenance: { title: "ai_wording", description: "ai_wording", steps: "reporter", expected_result: "ai_inferred", actual_result: "screenshot" },
          edited_fields: ["expected_result"],
          screenshot_observations: [
            { image: 1, kind: "status", observation: "A green message in the top right reads 'Draft saved'.", quote: "Draft saved" },
            { image: 1, kind: "ui_element", observation: "The Attachments field says no files are attached.", quote: "No attachments" },
          ],
        },
      },
      steps: [
        { at: d(15, "10:00"), as: "rafiq", assign: "maria" },
        { at: d(15, "10:20"), as: "maria", action: "start_review" },
        { at: d(4, "09:30"), as: "maria", action: "start_work" },
        { at: d(1, "11:05"), as: "maria", action: "request_info", input: { question: "Which browser were you using, and were the files attached before or after the first autosave (it runs every 30 seconds)?" } },
      ],
    },

    // Several engineers on one bug.
    {
      handle: "inventoryTotals",
      created: d(14, "09:15"),
      report: {
        by: "ingrid", project: "sds", module: "mobile", feature: "Inventory list",
        title: "Inventory totals differ between the web app and the mobile app",
        description: "The same location shows different totals on web and mobile.",
        steps: ["Open the inventory for 'Bergen Lab' on the web", "Open the same location in the mobile app", "Compare the total for 'Etanol 96%'"],
        expected: "Both show 12 L.",
        actual: "The web shows 12 L; the app shows 12,000 L.",
        severity: "major", priority: "high", device: "iPhone 15", os: "iOS 17.5", version: "3.7.2", frequency: "always",
        files: [{ kind: "shot", name: "inventory-totals.png", shot: mob({ crumbs: ["Inventory", "Bergen Lab"], heading: "Bergen Lab", table: { columns: [], rows: [["Etanol 96%", "12 000 L"], ["Aceton", "4 L"], ["Isopropanol", "2 L"]], markRow: 0 } }) }],
      },
      steps: [
        { at: d(13, "10:00"), as: "erik", action: "start_work" },
        { at: d(13, "10:30"), as: "erik", collaborators: ["maria", "kamal"] },
        { at: d(12, "15:00"), as: "maria", comment: "The web API returns millilitres for this unit since 2.14; the app assumes litres." },
        { at: d(11, "09:40"), as: "kamal", comment: "App side: we'll read the unit field instead of assuming litres. @Erik can you update the API contract?" },
        { at: d(8, "14:00"), as: "erik", comment: "API contract updated and deployed to staging. Waiting for the app build." },
      ],
    },

    // BUG-000112: Not a Bug, waiting for the reporter to review the decision.
    {
      handle: "archivedCompanies",
      number: 112,
      created: d(13, "14:30"),
      report: {
        by: "wahid", project: "hub", module: "crm", feature: "Companies",
        title: "Archived companies are missing from the company picker",
        description: "After archiving a company, it can no longer be chosen for a new contact.",
        steps: ["Archive the company 'Padma Logistics' in CRM › Companies", "Go to CRM › Contacts and click New contact", "Open the Company picker"],
        expected: "All companies, including Padma Logistics, can be selected.",
        actual: "Padma Logistics is not listed.",
        severity: "minor", env: "Staging", browser: "Chrome 128", frequency: "always",
      },
      steps: [
        { at: d(12, "10:00"), as: "rafiq", action: "start_review" },
        {
          at: d(2, "13:40"), as: "rafiq", action: "mark_not_a_bug",
          input: { category: "works_as_designed", reason: "Archived companies are hidden from pickers on purpose, so new contacts aren't linked to closed accounts. Unarchive the company first, or use the 'Include archived' filter on the Companies page." },
        },
      ],
    },

    // Fixed but not yet testable (waiting for a build).
    {
      handle: "curvedLabels",
      created: d(12, "10:40"),
      report: {
        by: "sadia", project: "sds", module: "mobile", feature: "Barcode scan",
        title: "Scanner can't read DataMatrix codes on curved containers",
        description: "GS1 DataMatrix codes printed on round bottles are never recognised.",
        steps: ["Open Scan", "Point the camera at the DataMatrix code on a 1 L round bottle"],
        expected: "The product is recognised within a few seconds.",
        actual: "The scanner keeps searching; nothing is recognised after 30 seconds.",
        severity: "major", device: "iPhone 15", os: "iOS 17.5", version: "3.7.2", frequency: "always",
      },
      steps: [
        { at: d(11, "09:00"), as: "sofie", action: "start_work" },
        { at: d(2, "16:45"), as: "sofie", action: "mark_fixed", input: { resolution: "Enabled curved-surface decoding in the scanner SDK.", fix_version: "3.8.0 (TestFlight 214)", root_cause: "third_party", available_now: false } },
      ],
    },

    // BUG-000119: Duplicate of BUG-000102; the reporter keeps credit on the original.
    {
      handle: "leadNoEmailAgain",
      number: 119,
      created: d(10, "15:15"),
      report: {
        by: "wahid", project: "hub", module: "crm", feature: "Leads",
        title: "Can create a lead without an email address",
        description: "The New lead form doesn't require an email address.",
        steps: ["Open CRM › Leads", "Click New lead and leave Email blank", "Click Save"],
        expected: "The form doesn't allow saving without an email address.",
        actual: "The lead is saved; the Email column shows a dash.",
        severity: "minor", env: "QA", browser: "Firefox 130", frequency: "always",
        duplicateCheck: { decision: "submitted_anyway", note: "Might be the same as the web form bug, but this is the New lead form inside CRM.", candidates: ["leadNoEmail"] },
      },
      steps: [
        { at: d(1, "10:25"), as: "tahmid", action: "mark_duplicate", input: { duplicate_of: "{key:leadNoEmail}", note: "Same missing validation as {key:leadNoEmail}. Fixing both in one change." } },
      ],
    },

    // Disputed Not a Bug waiting for the QA lead.
    {
      handle: "exposureRounding",
      created: d(9, "09:40"),
      report: {
        by: "tanvir", project: "sds", module: "reports", feature: "Exposure report",
        title: "Exposure report rounds concentrations to whole numbers",
        description: "Low concentrations are rounded down to 0 in the exposure report.",
        steps: ["Go to Reports › Exposure report", "Run it for 'Oslo HQ – Lab'", "Look at the Concentration column"],
        expected: "Concentrations are shown with two decimals (for example 0.35 mg/m³).",
        actual: "Values are rounded to whole numbers, so 0.35 mg/m³ is shown as 0 mg/m³.",
        severity: "major", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["compliance"],
        files: [{ kind: "shot", name: "exposure-rounding.png", shot: sds("Reports", { crumbs: ["Reports", "Exposure report"], heading: "Oslo HQ – Lab", table: { columns: ["Product", "Substance", "Concentration"], rows: [["Aceton", "Acetone", "12 mg/m³"], ["Etanol 96%", "Ethanol", "0 mg/m³"], ["Xylen", "Xylene", "1 mg/m³"]], markRow: 1 }, note: "Should be 0.35 mg/m³" }) }],
      },
      steps: [
        { at: d(9, "10:10"), as: "lars", assign: "maria" },
        { at: d(7, "14:00"), as: "maria", action: "mark_not_a_bug", input: { category: "works_as_designed", reason: "Rounding follows the report template agreed with customers in 2025." } },
        { at: d(6, "09:20"), as: "tanvir", action: "dispute", input: { reason: "The template requires two decimals for values below 1 mg/m³ (section 4.2). Showing 0 hides real exposure, which is a compliance risk." } },
      ],
    },

    // One problem, several modules.
    {
      handle: "dateFormat",
      created: d(8, "13:10"),
      report: {
        by: "sadia", project: "sds", module: "settings", feature: "Language", alsoAffects: ["reports"],
        title: "Date pickers read typed dates in US format for Norwegian users",
        description: "Typing a date in Norwegian format is interpreted as month.day in several modules.",
        steps: ["Set Settings › Language to Norsk", "Open any date picker (member start date, report period)", "Type 03.09.2026"],
        expected: "The date is read as 3 September 2026.",
        actual: "The date is read as 9 March 2026.",
        severity: "minor", env: "QA", browser: "Chrome 128", frequency: "always", tags: ["dates", "localization"],
      },
      steps: [
        { at: d(7, "10:00"), as: "lars", action: "start_review" },
        { at: d(7, "10:05"), as: "lars", action: "confirm" },
      ],
    },

    // Information requested from a QA analyst who isn't the reporter.
    {
      handle: "multiPlacementExport",
      created: d(6, "10:00"),
      report: {
        by: "sadia", project: "sds", module: "reports", feature: "Chemical register export",
        title: "Register export misses sites for members with several placements",
        description: "Products are missing from the register export when the exporting member is placed at several sites.",
        steps: ["Log in as a member placed at Oslo HQ and Bergen", "Go to Reports › Chemical register", "Export for all my sites"],
        expected: "Products from both sites are in the export.",
        actual: "Only Oslo HQ products are exported.",
        severity: "major", env: "Staging", browser: "Chrome 128", frequency: "always",
      },
      steps: [
        { at: d(6, "11:00"), as: "lars", assign: "imran" },
        { at: d(5, "09:00"), as: "imran", action: "start_work" },
        { at: d(1, "16:10"), as: "imran", action: "request_info", input: { requested_from_id: "@wahid", question: "Wahid, you wrote the test case for multi-placement exports. Which test company and member did you use?" } },
      ],
    },

    // BUG-000124: the brief's detail-page timeline, from report to close.
    {
      handle: "exportLetters",
      number: 124,
      created: d(4, "10:32"),
      report: {
        by: "wahid", project: "hub", module: "crm", feature: "Import & export",
        title: "Exported contact list shows garbled letters in names",
        description: "The contact list exported to CSV shows broken characters where names contain letters such as ø, é or Bangla script.",
        steps: ["Go to CRM › Contacts", "Filter by owner 'Wahid Hasan'", "Click Export › CSV", "Open the file in Excel"],
        expected: "Names appear exactly as in CRM (for example 'Søren Ødegård' and 'রহিম উদ্দিন').",
        actual: "Names show garbled characters such as 'SÃ¸ren Ã˜degÃ¥rd'.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["export"],
      },
      steps: [
        { at: d(4, "11:15"), as: "rafiq", assign: "maria" },
        { at: d(4, "13:20"), as: "maria", action: "request_info", input: { question: "Does it happen for every export or only CSV? And only for some contacts?" } },
        {
          at: d(4, "14:10"), as: "wahid", action: "provide_info", input: { answer: "Every CSV export I tried. The Excel (.xlsx) export is fine. Screenshot of the file attached." },
          files: [{ kind: "shot", name: "contacts-csv.png", shot: hub("CRM", { crumbs: ["CRM", "Contacts", "Export"], heading: "contacts.csv in Excel", table: { columns: ["Name", "Company", "Owner"], rows: [["SÃ¸ren Ã˜degÃ¥rd", "Nordlys AS", "Wahid Hasan"], ["Karim Ahmed", "Delta Traders Ltd", "Wahid Hasan"], ["à¦°à¦¹à¦¿à¦®", "Rupali Foods", "Wahid Hasan"]], markRow: 0 }, note: "Should read Søren Ødegård" }) }],
        },
        { at: d(3, "09:15"), as: "maria", action: "start_work" },
        { at: d(3, "10:30"), as: "maria", action: "mark_fixed", input: { resolution: "The CSV export now writes UTF-8 with a byte-order mark, so Excel reads the letters correctly.", fix_version: "4.14.2", root_cause: "backend", available_now: false } },
        { at: d(3, "11:00"), as: "maria", action: "ready_for_regression", input: { build: "4.14.2" } },
        { at: d(3, "11:50"), as: "wahid", action: "start_regression" },
        { at: d(3, "12:15"), as: "wahid", action: "pass_regression", input: { notes: "Exported 40 contacts with Norwegian and Bangla names; correct in Excel and Google Sheets. The .xlsx export is unchanged.", build: "4.14.2" } },
      ],
    },

    // BUG-000125: new, auto-assigned to the module owner, untouched (needs attention).
    {
      handle: "welcomePlaceholder",
      number: 125,
      created: d(3, "14:05"),
      report: {
        by: "ingrid", project: "hub", module: "crm", feature: "Contacts",
        title: "Welcome email shows the raw placeholder {{company_name}}",
        description: "Welcome emails sent to new contacts contain an unreplaced template placeholder instead of the company name.",
        steps: ["Go to CRM › Contacts › New contact", "Tick 'Send welcome email' and save", "Open the welcome email"],
        expected: "The email says 'Welcome to Delta Traders Ltd'.",
        actual: "The email says 'Welcome to {{company_name}}'.",
        severity: "minor", env: "Production", browser: "Firefox 130", frequency: "always", tags: ["email"],
      },
      steps: [],
    },

    // Under review by an engineer.
    {
      handle: "bulkRowsReview",
      created: d(2, "10:15"),
      report: {
        by: "tanvir", project: "sds", module: "supplier", feature: "Validation",
        title: "Bulk upload validation reports row numbers one lower than the sheet",
        description: "Errors in the product sheet point to the wrong row.",
        steps: ["Download the product sheet template", "Put an invalid UFI code in row 5", "Upload the sheet"],
        expected: "The error mentions row 5.",
        actual: "The error mentions row 4.",
        severity: "minor", env: "Staging", browser: "Chrome 128", frequency: "always",
        files: [{ kind: "shot", name: "validation-rows.png", shot: sup("Documents", { crumbs: ["Documents", "Bulk upload", "Validation"], heading: "product_sheet.xlsx", banner: { tone: "error", text: "Row 4: UFI code 'X12-ABC' is not valid" }, note: "The invalid UFI is in row 5" }) }],
      },
      steps: [{ at: d(1, "09:30"), as: "imran", action: "start_review" }],
    },

    // Two people report the same problem minutes apart.
    {
      handle: "searchNorwegianA",
      created: t.hoursAgo(5.2),
      report: {
        by: "sadia", project: "sds", module: "hub", feature: "SDS search",
        title: "SDS search returns no results for product names with æ, ø or å",
        description: "Searching for products with Norwegian letters in the name returns no results.",
        steps: ["Go to SDS Hub › Search", "Search for 'Rødsprit'"],
        expected: "Search results include Rødsprit 5 L.",
        actual: "'No results' is shown for product names with Norwegian letters.",
        severity: "major", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["search", "localization"],
      },
      steps: [],
    },
    {
      handle: "searchNorwegianB",
      created: t.hoursAgo(5.15),
      report: {
        by: "ingrid", project: "sds", module: "hub", feature: "SDS search",
        title: "SDS search ignores Norwegian letters in product names",
        description: "Product names with Norwegian letters return no results in SDS Hub search.",
        steps: ["Open SDS Hub search", "Search for 'Blåfarge'"],
        expected: "Products named Blåfarge are in the search results.",
        actual: "No results are shown for product names with Norwegian letters.",
        severity: "major", env: "Staging", browser: "Safari 17", frequency: "always", tags: ["search"],
      },
      steps: [],
    },

    // Critical production issue reported this morning.
    {
      handle: "vatAmpersand",
      created: t.hoursAgo(3),
      report: {
        by: "ingrid", project: "sds", module: "supplier", feature: "Registration",
        title: "Supplier registration fails with a server error for company names with '&'",
        description: "Suppliers whose company name contains '&' can't register.",
        steps: ["Open supplier registration on the production portal", "Enter company name 'Berg & Sønn AS' and fill in the other fields", "Click Register"],
        expected: "The supplier account is created.",
        actual: "'Something went wrong' (HTTP 500) is shown and no account is created.",
        severity: "critical", priority: "urgent", env: "Production", browser: "Chrome 128", frequency: "always",
        files: [{ kind: "shot", name: "registration-500.png", shot: sup("Account", { crumbs: ["Register"], heading: "Create a supplier account", fields: [{ label: "Company name", value: "Berg & Sønn AS", mark: true }, { label: "VAT number", value: "NO 912 345 678 MVA" }], banner: { tone: "error", text: "Something went wrong (500). Please try again later." } }) }],
      },
      steps: [
        { at: t.hoursAgo(2.2), as: "lars", action: "start_work" },
        { at: t.hoursAgo(1.5), as: "lars", comment: "The company-name slug generator throws on '&'. Hotfix in progress." },
      ],
    },
  ];
}
