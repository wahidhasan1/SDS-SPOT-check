// Hand-written demo stories. Each exercises a workflow or edge case from the product brief;
// several use the exact bug numbers from the brief's examples.

import type { OrgEvent, Scenario, TimeHelpers } from "./script";
import type { ShotSpec } from "./screenshots";

const SDS_NAV = ["Dashboard", "SDS Hub", "EHS", "Members", "Sites", "Reports", "Settings"];
const SUP_NAV = ["Documents", "Products", "Account"];

const sds = (active: string, rest: Omit<ShotSpec, "app" | "nav" | "active">): ShotSpec => ({ app: "SDS Manager", nav: SDS_NAV, active, ...rest });
const mob = (rest: Omit<ShotSpec, "app" | "nav" | "active" | "mobile">): ShotSpec => ({ app: "SDS Manager", nav: [], active: "", mobile: true, ...rest });
const sup = (active: string, rest: Omit<ShotSpec, "app" | "nav" | "active">): ShotSpec => ({ app: "Supplier Portal", nav: SUP_NAV, active, ...rest });

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
        by: "ingrid", project: "sup", module: "upload", feature: "Bulk upload",
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
        by: "tanvir", project: "sds", module: "ehs", feature: "Audits",
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
        by: "sadia", project: "mob", module: "login", feature: "Password reset",
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
        title: "Audit export uses American dates for Norwegian companies",
        description: "Exported audit reports show dates as MM/DD/YYYY even when the company language is Norwegian.",
        steps: ["Set Settings › Language to Norsk", "Open EHS › Audits and export any audit", "Check the dates in the export"],
        expected: "Dates use DD.MM.YYYY.",
        actual: "Dates are shown as 08/14/2026.",
        severity: "minor", env: "QA", browser: "Chrome 127", frequency: "always", tags: ["dates", "localization"],
      },
      steps: [
        { at: d(44, "09:30"), as: "lars", assign: "erik" },
        { at: d(43, "14:00"), as: "erik", action: "start_work" },
        { at: d(40, "11:20"), as: "erik", comment: "The export service formats dates on the server without the company locale. Fix is half done on branch fix/audit-date-locale." },
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
        by: "ingrid", project: "mob", module: "offline", feature: "Sync",
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
        by: "farhan", project: "sds", module: "ehs", feature: "Risk assessments",
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
      handle: "roleNotSaved",
      number: 87,
      created: d(27, "11:20"),
      report: {
        by: "tanvir", project: "sds", module: "members", feature: "Edit member",
        title: "Member role changes are not saved",
        description: "Changing a member's role shows 'Member updated', but the old role is back when the member is opened again.",
        steps: ["Go to Members", "Open an existing member (for example Kari Nordmann)", "Change Role from Viewer to Editor", "Click Save", "Close the member and open it again"],
        expected: "The member keeps the Editor role.",
        actual: "'Member updated' is shown, but the member has the Viewer role again after reopening.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["roles"],
        files: [
          {
            kind: "shot", name: "member-role-after-reopen.png",
            shot: sds("Members", { crumbs: ["Members", "Kari Nordmann"], heading: "Kari Nordmann", fields: [{ label: "Email", value: "kari.nordmann@nordicchem.no" }, { label: "Role", value: "Viewer", mark: true }, { label: "Site placements", value: "Oslo HQ" }], toast: { tone: "success", text: "Member updated" }, note: "Changed to Editor, still Viewer" }),
          },
        ],
      },
      steps: [
        { at: d(26, "09:05"), as: "rafiq", action: "start_review" },
        { at: d(26, "09:40"), as: "rafiq", action: "request_info", input: { question: "Is this for every role change or only Viewer → Editor? Does a hard refresh make a difference?" } },
        {
          at: d(26, "13:15"), as: "tanvir", action: "provide_info",
          input: { answer: "Every change I tried (Viewer → Editor and Editor → Admin). A hard refresh doesn't help. Network log attached." },
          files: [{ kind: "log", name: "network-log.txt", text: "PATCH /api/members/2231  200  12 ms\nrequest body: {\"name\":\"Kari Nordmann\",\"role\":\"viewer\",\"sites\":[\"oslo-hq\"]}\nGET /api/members/2231  200\nresponse: {\"role\":\"viewer\"}\n" }],
        },
        { at: d(25, "10:30"), as: "rafiq", action: "start_work" },
        { at: d(24, "15:10"), as: "rafiq", comment: "Found it: the role dropdown updates local state, but the PATCH body is built from the original member object (see the log: role is still 'viewer'). The fix depends on the members API change planned for 2.15." },
        { at: d(12, "10:00"), as: "hanne", priority: "urgent", reason: "Three customer escalations this week." },
        { at: d(3, "16:20"), as: "sadia", alsoSeen: "Same with site placement roles on the Oslo site." },
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
      handle: "reqEmptyProduct",
      number: 102,
      created: d(20, "10:05"),
      report: {
        by: "sadia", project: "sds", module: "hub", feature: "Supplier requests",
        title: "Supplier request form accepts an empty product name",
        description: "A supplier SDS request can be sent without a product name.",
        steps: ["Go to SDS Hub › Supplier requests", "Click New request", "Choose a supplier and leave Product name empty", "Click Send"],
        expected: "Validation asks for a product name.",
        actual: "The request is sent and the supplier gets an email with a blank product name.",
        severity: "major", env: "QA", browser: "Chrome 128", frequency: "always", tags: ["validation"],
      },
      steps: [
        { at: d(19, "09:30"), as: "maria", action: "start_work" },
        { at: d(9, "11:00"), as: "maria", comment: "Server-side validation is missing too. Adding both, plus a test." },
      ],
    },

    // Also seen: co-reporter with extra evidence.
    {
      handle: "sessionIncident",
      created: d(19, "11:30"),
      report: {
        by: "tanvir", project: "sds", module: "ehs", feature: "Incident reports",
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
          files: [{ kind: "shot", name: "session-expired.png", shot: sds("EHS", { crumbs: ["EHS", "Risk assessments", "New"], heading: "Session expired", banner: { tone: "warning", text: "Your session has expired. Please log in again." }, note: "Form content lost" }) }],
        },
        { at: d(14, "09:15"), as: "imran", action: "start_work" },
      ],
    },

    // BUG-000104: failed regression once, fixed again, regression required now.
    {
      handle: "revisionDate",
      number: 104,
      created: d(18, "13:45"),
      report: {
        by: "wahid", project: "sds", module: "hub", feature: "Revision tracking",
        title: "Revision date not updated after uploading a new SDS version",
        description: "Uploading a new revision of an SDS keeps the old revision date on the detail page.",
        steps: ["Open an SDS in SDS Hub (for example 'Rødsprit 5 L')", "Click Upload new revision", "Upload the supplier's revised PDF (revision date 02.09.2026)", "Look at Revision date on the SDS page"],
        expected: "Revision date shows 02.09.2026 from the new PDF.",
        actual: "Revision date still shows 14.03.2024.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["revisions", "compliance"],
        files: [{ kind: "shot", name: "revision-date.png", shot: sds("SDS Hub", { crumbs: ["SDS Hub", "Rødsprit 5 L"], heading: "Rødsprit 5 L", fields: [{ label: "Supplier", value: "Kemetyl Norge AS" }, { label: "Revision date", value: "14.03.2024", mark: true }, { label: "Version", value: "4" }], toast: { tone: "success", text: "New revision uploaded" } }) }],
      },
      steps: [
        { at: d(17, "10:10"), as: "maria", action: "start_work" },
        { at: d(11, "15:30"), as: "maria", action: "mark_fixed", input: { resolution: "The revision date is re-extracted from the new PDF on upload.", fix_version: "2.14.1", root_cause: "backend" } },
        { at: d(10, "11:20"), as: "wahid", action: "start_regression" },
        {
          at: d(10, "14:05"), as: "wahid", action: "fail_regression",
          input: { details: "Works for PDFs uploaded on the SDS page, but revisions that arrive through a supplier request still keep the old date.", build: "2.14.1" },
          files: [{ kind: "shot", name: "revision-date-supplier-request.png", shot: sds("SDS Hub", { crumbs: ["SDS Hub", "Supplier requests", "REQ-4471"], heading: "Rødsprit 5 L", fields: [{ label: "Uploaded by supplier", value: "02.09.2026" }, { label: "Revision date", value: "14.03.2024", mark: true }] }) }],
        },
        { at: d(9, "09:15"), as: "maria", action: "start_work" },
        { at: d(1, "15:40"), as: "maria", action: "mark_fixed", input: { resolution: "Supplier-request uploads now go through the same extraction step as manual uploads.", fix_version: "2.14.2", root_cause: "backend" } },
      ],
    },

    // BUG-000108: AI-assisted report; engineer waiting for information from QA.
    {
      handle: "incidentPhotos",
      number: 108,
      created: d(16, "09:50"),
      report: {
        by: "wahid", project: "sds", module: "ehs", feature: "Incident reports",
        title: "Photos disappear from an incident report saved as a draft",
        description: "Photos added to a new incident report are gone after saving it as a draft and opening it again.",
        steps: ["Go to EHS › Incident reports", "Click New incident", "Add two photos under Evidence", "Click Save as draft", "Open the draft again from the list"],
        expected: "The two photos are still attached to the draft.",
        actual: "The draft opens with 'No photos added', although 'Draft saved' was shown.",
        severity: "major", env: "QA", browser: "Edge 128", frequency: "always",
        files: [{ kind: "shot", name: "draft-photos.png", shot: sds("EHS", { crumbs: ["EHS", "Incident reports", "Draft #318"], heading: "Forklift collision in Lager B", fields: [{ label: "Incident date", value: "08.09.2026" }, { label: "Evidence", value: "No photos added", mark: true }], toast: { tone: "success", text: "Draft saved" } }) }],
        ai: {
          provider: "anthropic",
          model: "claude-opus-5",
          drafted_fields: ["title", "description", "steps", "expected_result", "actual_result"],
          provenance: { title: "ai_wording", description: "ai_wording", steps: "reporter", expected_result: "ai_inferred", actual_result: "screenshot" },
          edited_fields: ["expected_result"],
          screenshot_observations: [
            { image: 1, kind: "status", observation: "A green message in the top right reads 'Draft saved'.", quote: "Draft saved" },
            { image: 1, kind: "ui_element", observation: "The Evidence field says no photos are attached.", quote: "No photos added" },
          ],
        },
      },
      steps: [
        { at: d(15, "10:20"), as: "imran", action: "start_review" },
        { at: d(4, "09:30"), as: "imran", action: "start_work" },
        { at: d(1, "11:05"), as: "imran", action: "request_info", input: { question: "Which browser were you using, and were the photos added before or after the first autosave (it runs every 30 seconds)?" } },
      ],
    },

    // Several engineers on one bug.
    {
      handle: "inventoryTotals",
      created: d(14, "09:15"),
      report: {
        by: "ingrid", project: "mob", module: "inventory", feature: "Inventory list",
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
      handle: "archivedSites",
      number: 112,
      created: d(13, "14:30"),
      report: {
        by: "wahid", project: "sds", module: "sites", feature: "Location picker",
        title: "Archived sites are missing from the location picker",
        description: "After archiving a site, it can no longer be chosen as a product location.",
        steps: ["Archive the site 'Drammen Lager' in Sites", "Open any product", "Click Change location"],
        expected: "All sites, including Drammen Lager, can be selected.",
        actual: "Drammen Lager is not listed.",
        severity: "minor", env: "Staging", browser: "Chrome 128", frequency: "always",
      },
      steps: [
        { at: d(12, "10:00"), as: "rafiq", action: "start_review" },
        {
          at: d(2, "13:40"), as: "rafiq", action: "mark_not_a_bug",
          input: { category: "works_as_designed", reason: "Archived sites are hidden from pickers on purpose so products can't be moved to closed sites. Unarchive the site first, or use the 'Include archived' filter on the Sites page." },
        },
      ],
    },

    // Fixed but not yet testable (waiting for a build).
    {
      handle: "curvedLabels",
      created: d(12, "10:40"),
      report: {
        by: "sadia", project: "mob", module: "scanner", feature: "Barcode scan",
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
      handle: "reqNoName",
      number: 119,
      created: d(10, "15:15"),
      report: {
        by: "wahid", project: "sds", module: "hub", feature: "Supplier requests",
        title: "Can send a supplier SDS request without a product name",
        description: "The supplier request form doesn't require a product name.",
        steps: ["Open SDS Hub › Supplier requests", "Create a request and leave the product name blank", "Send it"],
        expected: "The form doesn't allow sending without a product name.",
        actual: "The request is sent; the supplier's email says 'Product:' followed by nothing.",
        severity: "minor", env: "QA", browser: "Firefox 130", frequency: "always",
        duplicateCheck: { decision: "submitted_anyway", note: "Might be the same as the empty product name bug, but I saw it in the supplier's email.", candidates: ["reqEmptyProduct"] },
      },
      steps: [
        { at: d(1, "10:25"), as: "maria", action: "mark_duplicate", input: { duplicate_of: "{key:reqEmptyProduct}", note: "Same missing validation as {key:reqEmptyProduct}. Fixing both in one change." } },
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
        by: "sadia", project: "sds", module: "settings", feature: "Language", alsoAffects: ["ehs", "reports"],
        title: "Date pickers read typed dates in US format for Norwegian users",
        description: "Typing a date in Norwegian format is interpreted as month.day in several modules.",
        steps: ["Set Settings › Language to Norsk", "Open any date picker (incident date, report period)", "Type 03.09.2026"],
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
      handle: "pictograms",
      number: 124,
      created: d(4, "10:32"),
      report: {
        by: "wahid", project: "sds", module: "reports", feature: "Chemical register export",
        title: "Hazard pictograms missing from the chemical register PDF",
        description: "The chemical register PDF export shows empty boxes where the GHS hazard pictograms should be.",
        steps: ["Go to Reports › Chemical register", "Select the site 'Oslo HQ'", "Click Export › PDF", "Open the PDF"],
        expected: "Each product row shows its GHS pictograms (for example the GHS02 flame for ethanol).",
        actual: "The Pictograms column shows empty boxes for every product.",
        severity: "major", priority: "high", env: "Staging", browser: "Chrome 128", frequency: "always", tags: ["pdf", "compliance"],
      },
      steps: [
        { at: d(4, "11:15"), as: "lars", assign: "maria" },
        { at: d(4, "13:20"), as: "maria", action: "request_info", input: { question: "Does it happen for every site or only Oslo HQ? And is it only the PDF, or the Excel export too?" } },
        {
          at: d(4, "14:10"), as: "wahid", action: "provide_info", input: { answer: "Every site I tried (Oslo HQ and Bergen). Excel is fine; only the PDF. Screenshot of the PDF attached." },
          files: [{ kind: "shot", name: "register-pdf-pictograms.png", shot: sds("Reports", { crumbs: ["Reports", "Chemical register", "PDF preview"], heading: "Chemical register – Oslo HQ", table: { columns: ["Product", "Supplier", "Pictograms"], rows: [["Etanol 96%", "Kemetyl", "[ ]  [ ]"], ["Aceton", "VWR", "[ ]"], ["Natronlut 25%", "Merck", "[ ]  [ ]"]], markRow: 0 }, note: "Pictograms render as empty boxes" }) }],
        },
        { at: d(3, "09:15"), as: "maria", action: "start_work" },
        { at: d(3, "10:30"), as: "maria", action: "mark_fixed", input: { resolution: "The PDF renderer couldn't load the SVG pictograms; they are now embedded as PNG images.", fix_version: "2.14.2", root_cause: "backend", available_now: false } },
        { at: d(3, "11:00"), as: "maria", action: "ready_for_regression", input: { build: "2.14.2" } },
        { at: d(3, "11:50"), as: "wahid", action: "start_regression" },
        { at: d(3, "12:15"), as: "wahid", action: "pass_regression", input: { notes: "Checked Oslo HQ and Bergen: every pictogram renders in the PDF. Excel export unchanged.", build: "2.14.2" } },
      ],
    },

    // BUG-000125: new, auto-assigned to the module owner, untouched (needs attention).
    {
      handle: "invitePlaceholder",
      number: 125,
      created: d(3, "14:05"),
      report: {
        by: "ingrid", project: "sds", module: "members", feature: "Invite member",
        title: "Invitation email shows the raw placeholder {{company_name}}",
        description: "Invitation emails contain an unreplaced template placeholder instead of the company name.",
        steps: ["Go to Members › Invite member", "Invite a new person", "Open the invitation email"],
        expected: "The email says 'You've been invited to join Nordic Chem AS'.",
        actual: "The email says 'You've been invited to join {{company_name}}'.",
        severity: "minor", env: "Production", browser: "Firefox 130", frequency: "always", tags: ["email"],
      },
      steps: [],
    },

    // Under review by an engineer.
    {
      handle: "bulkRowsReview",
      created: d(2, "10:15"),
      report: {
        by: "tanvir", project: "sup", module: "upload", feature: "Validation",
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
        by: "ingrid", project: "sup", module: "account", feature: "Registration",
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
