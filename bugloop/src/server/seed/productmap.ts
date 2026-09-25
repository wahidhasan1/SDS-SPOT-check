// Sample product maps: the screens of each demo project, what is on them and how they must behave.
// Imported through the same service a team uses for its own map.

import type { ProductMap } from "../services/pages";

export const PRODUCT_MAPS: Record<string, ProductMap> = {
  sds: {
    modules: [
      {
        name: "Members",
        features: [
          {
            name: "Edit member",
            pages: [
              {
                name: "Edit member",
                path: "/members/:id/edit",
                description: "Form for a member's details, role and site placements. Opened from the member list.",
                elements: ["Name field", "Email field", "Phone field", "Role dropdown", "Sites list", "Save button", "Cancel link", "'Saved' confirmation toast"],
                rules: [
                  "Saving keeps every changed field, and reopening the member shows the new values.",
                  "The role shown after saving is the role that was chosen.",
                  "Only administrators can change a member's role.",
                  "An empty phone field is saved as empty and shown as a dash, never as 'undefined'.",
                ],
                keywords: ["member settings", "member profile", "user settings", "edit user"],
                importance: "high",
              },
            ],
          },
          {
            name: "Invite member",
            pages: [
              {
                name: "Invite member",
                path: "/members/invite",
                description: "Dialog that sends an email invitation to a new member.",
                elements: ["Email field", "Role dropdown", "Sites picker", "Send invitation button", "Invitation email"],
                rules: [
                  "The invitation email shows the company name, never a raw placeholder.",
                  "An email address that is already a member is rejected with a clear message.",
                ],
                keywords: ["invitation", "invite user"],
                importance: "normal",
              },
            ],
          },
        ],
        pages: [
          {
            name: "Member list",
            path: "/members",
            description: "Searchable table of all members with role and sites.",
            elements: ["Search box", "Members table", "Role column", "Sites column", "Bulk actions menu", "Pagination"],
            rules: ["Search is not case-sensitive and matches names and email addresses.", "Bulk role changes apply to every selected member."],
            keywords: ["members page", "people list", "user list"],
            importance: "normal",
          },
        ],
      },
      {
        name: "SDS Hub",
        features: [
          {
            name: "SDS search",
            pages: [
              {
                name: "SDS search",
                path: "/sds",
                description: "Search safety data sheets by product name, supplier or CAS number.",
                elements: ["Search box", "Supplier filter", "Language filter", "Results list", "Suggestions dropdown"],
                rules: ["Search finds product names with Norwegian letters (æ, ø, å).", "Deleted products never appear in results or suggestions."],
                keywords: ["safety data sheet search", "find SDS"],
                importance: "high",
              },
            ],
          },
          {
            name: "SDS upload",
            pages: [
              {
                name: "Upload SDS",
                path: "/sds/upload",
                description: "Upload a new SDS or a new revision of an existing one.",
                elements: ["File drop area", "Product name field", "Revision date field", "Language dropdown", "Upload button"],
                rules: ["A new revision updates the revision date shown on the product.", "Revision dates in the future are rejected."],
                keywords: ["new revision", "upload document"],
                importance: "high",
              },
            ],
          },
          {
            name: "Supplier requests",
            pages: [
              {
                name: "Supplier request",
                path: "/sds/requests/new",
                description: "Ask a supplier for a missing or updated SDS.",
                elements: ["Supplier dropdown", "Product name field", "Message field", "Send request button", "Request status badge"],
                rules: ["A request cannot be sent without a product name.", "A request stays Pending until the supplier uploads the SDS, then shows Received."],
                importance: "normal",
              },
            ],
          },
        ],
      },
      {
        name: "EHS",
        features: [
          {
            name: "Incident reports",
            pages: [
              {
                name: "Incident report",
                path: "/ehs/incidents/:id",
                description: "Form for recording an incident, with people involved and photo evidence.",
                elements: ["Incident type dropdown", "Date field", "Injured persons list", "Remove person button", "Evidence photos", "Save as draft button", "Submit button"],
                rules: ["Photos added to a draft are still attached when the draft is reopened.", "Injured persons can be removed until the report is submitted."],
                keywords: ["incident", "accident report"],
                importance: "critical",
              },
            ],
          },
          {
            name: "Risk assessments",
            pages: [
              {
                name: "Risk assessment",
                path: "/ehs/risk/:id",
                description: "Risk assessment for a chemical at a site, with a PDF export.",
                elements: ["Hazard list", "Exposure fields", "Revision number", "Export PDF button"],
                rules: ["The PDF header shows the assessment's current revision number."],
                importance: "high",
              },
            ],
          },
        ],
      },
      {
        name: "Reports",
        features: [
          {
            name: "Chemical register export",
            pages: [
              {
                name: "Chemical register",
                path: "/reports/register",
                description: "The chemical register for one or more sites, exported to PDF or Excel.",
                elements: ["Site selector", "Export PDF button", "Export Excel button", "Pictograms column", "Supplier column"],
                rules: ["Every product row in the PDF shows its GHS hazard pictograms.", "The export file name uses the site's name.", "Members placed at several sites see every site in the register."],
                keywords: ["register export", "chemical list"],
                importance: "critical",
              },
            ],
          },
        ],
      },
      {
        name: "Sites",
        pages: [
          {
            name: "Location picker",
            feature: "Location picker",
            path: "/sites/picker",
            description: "Dialog for choosing a site and storage location.",
            elements: ["Site tree", "Include archived toggle", "Search box", "Select button"],
            rules: ["Archived sites are hidden unless 'Include archived' is on."],
            importance: "normal",
          },
        ],
      },
      {
        name: "Settings",
        pages: [
          {
            name: "Language settings",
            feature: "Language",
            path: "/settings/language",
            description: "Workspace language and date format.",
            elements: ["Language dropdown", "Date format dropdown", "Save button", "Left menu"],
            rules: ["Changing the language updates every menu without reloading.", "Date pickers use the chosen date format."],
            importance: "low",
          },
        ],
      },
    ],
  },
  mob: {
    modules: [
      {
        name: "Scanner",
        pages: [
          {
            name: "Scan barcode",
            feature: "Barcode scan",
            path: "app://scanner",
            description: "Camera view that reads product barcodes and DataMatrix codes.",
            elements: ["Camera view", "Scan frame", "Torch button", "Manual entry link", "Result card"],
            rules: ["DataMatrix codes on curved containers are read.", "The camera focuses on small labels."],
            importance: "high",
          },
        ],
      },
      {
        name: "Offline mode",
        pages: [
          {
            name: "Sync status",
            feature: "Sync",
            path: "app://sync",
            description: "Shows pending offline changes and the last sync.",
            elements: ["Pending changes list", "Sync now button", "Last synced time"],
            rules: ["Each offline change is applied exactly once after sync."],
            importance: "critical",
          },
        ],
      },
      {
        name: "Login & onboarding",
        pages: [
          {
            name: "Password reset",
            feature: "Password reset",
            path: "app://reset",
            description: "Request and complete a password reset from the app.",
            elements: ["Email field", "Send link button", "Reset link email"],
            rules: ["The reset link opens the mobile app when it is installed."],
            importance: "high",
          },
        ],
      },
    ],
  },
  sup: {
    modules: [
      {
        name: "Account",
        pages: [
          {
            name: "Supplier registration",
            feature: "Registration",
            path: "/register",
            description: "Sign-up form for new supplier companies.",
            elements: ["Company name field", "Organisation number field", "VAT number field", "Email field", "Register button", "Error message"],
            rules: ["Company names with '&' and other symbols are accepted.", "VAT numbers are validated for the selected country."],
            importance: "critical",
          },
        ],
      },
      {
        name: "Document upload",
        pages: [
          {
            name: "Bulk upload",
            feature: "Bulk upload",
            path: "/documents/bulk",
            description: "Upload many SDS files with a spreadsheet of product data.",
            elements: ["Spreadsheet upload", "File drop area", "Validation report", "Row numbers", "Start upload button"],
            rules: ["Validation errors point to the correct spreadsheet row number."],
            importance: "high",
          },
        ],
      },
    ],
  },
};
