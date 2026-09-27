// Sample product maps: the screens of each demo project, what is on them and how they must behave.
// Imported through the same service a team uses for its own map.

import type { ProductMap } from "../services/pages";

export const PRODUCT_MAPS: Record<string, ProductMap> = {
  hub: {
    modules: [
      {
        name: "CRM",
        features: [
          {
            name: "Contacts",
            pages: [
              {
                name: "Contact list",
                path: "/crm/contacts",
                description: "Searchable table of every contact, with owner, company and lifecycle stage.",
                elements: ["Search box", "Owner filter", "Lifecycle stage filter", "Contacts table", "Owner column", "Bulk actions menu", "Export button", "New contact button"],
                rules: ["Search matches names, email addresses and email domains.", "The Owner filter lists every owner by name, with '(inactive)' for people who left."],
                keywords: ["contacts page", "people list", "customer list"],
                importance: "normal",
              },
              {
                name: "Contact details",
                path: "/crm/contacts/:id",
                description: "One contact: header, owner, last activity and the timeline of calls, emails, meetings and notes.",
                elements: ["Contact header", "Owner field", "Last activity date", "Timeline", "Log activity button", "Merge button", "Notes tab", "Deals tab"],
                rules: [
                  "The timeline lists every call, email, meeting and note for the contact, newest first.",
                  "Last activity shows the date of the most recent call, email or meeting.",
                  "Merging two contacts keeps the activities, notes and files of both.",
                ],
                keywords: ["contact page", "contact profile", "customer profile", "timeline"],
                importance: "high",
              },
              {
                name: "Edit contact",
                path: "/crm/contacts/:id/edit",
                description: "Form for a contact's details, company, owner and lifecycle stage. Opened from the contact page.",
                elements: ["Name fields", "Email field", "Phone field", "Company picker", "Owner dropdown", "Lifecycle stage dropdown", "Send welcome email checkbox", "Save button", "Cancel link", "'Contact updated' toast"],
                rules: [
                  "Saving keeps every changed field, and reopening the contact shows the new values.",
                  "The owner shown after saving is the owner that was chosen.",
                  "Phone numbers keep their country code, including the '+'.",
                  "The welcome email shows the company name, never a raw placeholder.",
                ],
                keywords: ["contact settings", "edit customer", "change owner", "contact form"],
                importance: "high",
              },
            ],
          },
          {
            name: "Companies",
            pages: [
              {
                name: "Company details",
                path: "/crm/companies/:id",
                description: "One company: logo, tax ID, account manager, subsidiaries, contacts and notes.",
                elements: ["Company logo", "Tax ID field", "Account manager field", "Subsidiaries count", "Contacts tab", "Notes tab", "Add note button", "Attachments list", "'Draft saved' toast"],
                rules: [
                  "Notes saved as a draft keep their attachments when reopened.",
                  "The Subsidiaries count matches the companies on the Subsidiaries tab.",
                  "The Tax ID is validated for the company's country.",
                ],
                keywords: ["company page", "account page", "organisation"],
                importance: "high",
              },
              {
                name: "Company picker",
                path: "/crm/companies/picker",
                description: "Dialog for choosing a company on a contact, deal or ticket.",
                elements: ["Search box", "Include archived toggle", "Company list", "Select button"],
                rules: ["Archived companies are hidden unless 'Include archived' is on."],
                importance: "normal",
              },
            ],
          },
          {
            name: "Leads",
            pages: [
              {
                name: "Lead list",
                path: "/crm/leads",
                description: "New leads from forms, imports and sales, with score and source.",
                elements: ["New lead button", "Leads table", "Email column", "Score column", "Source column", "Convert button"],
                rules: ["A lead can't be saved without an email address.", "Converting a lead keeps the lead owner for the new contact and deal."],
                keywords: ["leads page", "prospects"],
                importance: "high",
              },
              {
                name: "Web-to-lead form",
                path: "hubone.example.com/contact",
                description: "Public contact form on the website that creates a lead in CRM.",
                elements: ["Name field", "Company field", "Email field", "Send button"],
                rules: ["The form can't be sent without an email address.", "The campaign source (UTM parameters) is stored on the lead."],
                keywords: ["website form", "contact form", "landing page"],
                importance: "high",
              },
            ],
          },
          {
            name: "Activities",
            pages: [
              {
                name: "Log activity",
                path: "/crm/contacts/:id/log",
                description: "Dialog for logging a call, email or meeting on a contact.",
                elements: ["Activity type dropdown", "Date and time field", "Notes field", "Follow-up task checkbox", "Save button", "'Call logged' toast"],
                rules: [
                  "Logging an activity updates the contact's Last activity date.",
                  "Times are shown in the user's time zone, as they were logged.",
                  "A follow-up reminder is sent once.",
                ],
                keywords: ["log call", "log email", "activity"],
                importance: "high",
              },
            ],
          },
          {
            name: "Import & export",
            pages: [
              {
                name: "Import contacts",
                path: "/crm/import",
                description: "Import contacts and companies from CSV or Excel, with column mapping and a preview.",
                elements: ["File upload", "Column mapping", "Date format dropdown", "'Update existing contacts' option", "Preview table", "Run import button"],
                rules: [
                  "With 'Update existing contacts', rows whose email matches an existing contact update it instead of creating a duplicate.",
                  "Dates are read in the chosen date format.",
                ],
                keywords: ["import", "csv import", "upload contacts"],
                importance: "critical",
              },
              {
                name: "Export contacts",
                path: "/crm/contacts/export",
                description: "Export the current contact list to CSV or Excel.",
                elements: ["Export menu", "CSV option", "Excel option", "Download link"],
                rules: ["Exported names keep every letter (æ, ø, å, é, Bangla) exactly as in CRM.", "Exports of any size complete; large exports are emailed when ready."],
                keywords: ["export", "csv", "excel", "download contacts"],
                importance: "high",
              },
            ],
          },
          {
            name: "Segments",
            pages: [
              {
                name: "Segment builder",
                path: "/crm/segments/:id",
                description: "Rules that group contacts for campaigns and reports.",
                elements: ["Rule builder", "AND/OR switch", "Member count", "Contact list", "Save button"],
                rules: ["The member count matches the contacts listed.", "OR groups return contacts matching any of the conditions."],
                keywords: ["segment", "list", "audience"],
                importance: "normal",
              },
            ],
          },
        ],
      },
      {
        name: "Sales",
        pages: [
          {
            name: "Pipeline board",
            feature: "Pipeline",
            path: "/sales/pipeline",
            description: "Kanban board of deals by stage, with totals.",
            elements: ["Stage columns", "Deal cards", "Won column", "Close date dialog", "Pipeline total"],
            rules: ["Moving a deal to Won asks for the close date and amount.", "Totals convert each deal's currency once."],
            importance: "high",
          },
          {
            name: "Quote editor",
            feature: "Quotes",
            path: "/sales/quotes/:id",
            description: "Build, send and download a quote.",
            elements: ["Quote lines", "VAT column", "Expiry date", "Download PDF button", "Send button"],
            rules: ["The PDF shows each line's VAT rate and a total including VAT.", "Expired quotes can't be accepted."],
            importance: "critical",
          },
        ],
      },
      {
        name: "Support",
        pages: [
          {
            name: "Ticket",
            feature: "Tickets",
            path: "/support/tickets/:id",
            description: "A customer ticket with the conversation, SLA and the linked CRM company.",
            elements: ["Conversation", "Reply box", "SLA timer", "Company sidebar", "Merge button"],
            rules: ["The SLA timer only counts business hours for business-hours plans.", "Merged tickets send replies from one ticket only."],
            importance: "high",
          },
        ],
      },
      {
        name: "Meetings",
        pages: [
          {
            name: "Calendar",
            feature: "Calendar",
            path: "/meetings",
            description: "Week view of meetings, synced with Google and Outlook.",
            elements: ["Week view", "Sync status", "Meeting card"],
            rules: ["Changes made in Google or Outlook appear within a minute.", "Holding a meeting updates the contact's Last activity in CRM."],
            importance: "normal",
          },
          {
            name: "Booking page",
            feature: "Scheduling",
            path: "/book/:user",
            description: "Public page where customers book a meeting.",
            elements: ["Time zone label", "Available slots", "Book button"],
            rules: ["Slots are shown in the visitor's time zone."],
            importance: "high",
          },
        ],
      },
      {
        name: "Ledger",
        pages: [
          {
            name: "Invoice",
            feature: "Invoices",
            path: "/ledger/invoices/:id",
            description: "An invoice with lines, payments and status.",
            elements: ["Invoice number", "Invoice lines", "Discount", "Status badge", "Register payment button", "Outstanding amount"],
            rules: ["Invoice numbers have no gaps.", "A partial payment sets the status to Partly paid.", "Invoices created from a deal keep the deal's discounts."],
            importance: "critical",
          },
        ],
      },
      {
        name: "Stride",
        pages: [
          {
            name: "Goal",
            feature: "Goals",
            path: "/stride/goals/:id",
            description: "A goal with its key results and progress.",
            elements: ["Progress bar", "Key results list"],
            rules: ["Progress updates as soon as a key result changes."],
            importance: "normal",
          },
          {
            name: "My tasks",
            feature: "Tasks",
            path: "/stride/tasks",
            description: "The signed-in person's tasks, grouped by due date.",
            elements: ["Due today group", "Overdue group", "Assignee picker"],
            rules: ["Tasks due later today are listed under Due today."],
            importance: "normal",
          },
        ],
      },
      {
        name: "Quality",
        pages: [
          {
            name: "Deviation",
            feature: "Deviations",
            path: "/quality/deviations/:id",
            description: "A deviation with its corrective actions.",
            elements: ["Deviation number", "Corrective actions list", "Due date"],
            rules: ["Every deviation has a unique number.", "Overdue corrective actions remind the responsible person."],
            importance: "high",
          },
        ],
      },
    ],
  },
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
      {
        name: "Mobile app",
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
          {
            name: "Sync status",
            feature: "Sync",
            path: "app://sync",
            description: "Shows pending offline changes and the last sync.",
            elements: ["Pending changes list", "Sync now button", "Last synced time"],
            rules: ["Each offline change is applied exactly once after sync."],
            importance: "critical",
          },
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
      {
        name: "Supplier portal",
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
  ehs: {
    modules: [
      {
        name: "Incidents",
        features: [
          {
            name: "Incident reports",
            pages: [
              {
                name: "Incident report",
                path: "/incidents/:id",
                description: "Form for recording an incident, with people involved and photo evidence.",
                elements: ["Incident type dropdown", "Date field", "Injured persons list", "Remove person button", "Evidence photos", "Save as draft button", "Submit button"],
                rules: ["Photos added to a draft are still attached when the draft is reopened.", "Injured persons can be removed until the report is submitted."],
                keywords: ["incident", "accident report"],
                importance: "critical",
              },
            ],
          },
        ],
      },
      {
        name: "Risk assessments",
        features: [
          {
            name: "Risk assessments",
            pages: [
              {
                name: "Risk assessment",
                path: "/risk/:id",
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
        name: "Audits",
        pages: [
          {
            name: "Audit checklist",
            feature: "Audits",
            path: "/audits/:id",
            description: "An audit from a checklist template, with tabs, answers and a score.",
            elements: ["Checklist tabs", "Question list", "Optional questions", "Score", "Finish audit button", "Export button"],
            rules: ["Answers are kept when switching between tabs.", "The score is never above 100%."],
            importance: "high",
          },
        ],
      },
    ],
  },
};
