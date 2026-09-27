// Demo organisation: people, teams, projects, modules and features. Names other than
// Wahid Hasan are fictional.

import type { Role, TeamKind } from "../../core/types";

export interface PersonSpec {
  key: string;
  name: string;
  role: Role;
  team: string;
  title: string;
  active?: boolean;
}

export const TEAMS: { key: string; name: string; kind: TeamKind; lead: string; description: string }[] = [
  { key: "qa", name: "QA", kind: "qa", lead: "nusrat", description: "Quality assurance for EHS, HUB ONE and SDS ONE." },
  { key: "hub", name: "HUB ONE Engineering", kind: "engineering", lead: "rafiq", description: "HUB ONE: CRM, Sales, Support, Meetings, Ledger, Stride and Quality." },
  { key: "platform", name: "Platform Engineering", kind: "engineering", lead: "lars", description: "SDS ONE and EHS web apps and APIs." },
  { key: "mobile", name: "Mobile Engineering", kind: "engineering", lead: "sofie", description: "The SDS ONE mobile app." },
  { key: "product", name: "Product", kind: "product", lead: "hanne", description: "Product management." },
  { key: "ops", name: "Operations", kind: "other", lead: "mahmud", description: "Internal tools and administration." },
];

export const PEOPLE: PersonSpec[] = [
  { key: "nusrat", name: "Nusrat Jahan", role: "qa_lead", team: "qa", title: "QA Lead" },
  { key: "wahid", name: "Wahid Hasan", role: "qa_analyst", team: "qa", title: "QA Analyst" },
  { key: "tanvir", name: "Tanvir Ahmed", role: "qa_analyst", team: "qa", title: "QA Analyst" },
  { key: "sadia", name: "Sadia Rahman", role: "qa_analyst", team: "qa", title: "QA Analyst" },
  { key: "ingrid", name: "Ingrid Solberg", role: "qa_analyst", team: "qa", title: "Senior QA Analyst" },
  { key: "farhan", name: "Farhan Kabir", role: "qa_analyst", team: "qa", title: "QA Analyst", active: false },
  { key: "lars", name: "Lars Haugen", role: "engineer", team: "platform", title: "Lead Engineer" },
  { key: "rafiq", name: "Rafiq Chowdhury", role: "engineer", team: "hub", title: "Lead Engineer, HUB ONE CRM" },
  { key: "maria", name: "Maria Olsen", role: "engineer", team: "hub", title: "Full-stack Engineer" },
  { key: "tahmid", name: "Tahmid Rahman", role: "engineer", team: "hub", title: "Backend Engineer" },
  { key: "sabrina", name: "Sabrina Akter", role: "engineer", team: "hub", title: "Frontend Engineer" },
  { key: "imran", name: "Imran Hossain", role: "engineer", team: "platform", title: "Full-stack Engineer" },
  { key: "sofie", name: "Sofie Berg", role: "engineer", team: "mobile", title: "Mobile Lead" },
  { key: "kamal", name: "Kamal Uddin", role: "engineer", team: "mobile", title: "Mobile Engineer" },
  { key: "erik", name: "Erik Nilsen", role: "engineer", team: "mobile", title: "Mobile Engineer" },
  { key: "jakob", name: "Jakob Lund", role: "engineer", team: "platform", title: "Frontend Engineer", active: false },
  { key: "hanne", name: "Hanne Lie", role: "project_manager", team: "product", title: "Product Manager" },
  { key: "jonas", name: "Jonas Strand", role: "project_manager", team: "product", title: "Product Manager" },
  { key: "mahmud", name: "Mahmud Karim", role: "admin", team: "ops", title: "Workspace Administrator" },
];

export interface ModuleSpec {
  key: string;
  name: string;
  owner: string | null;
  description: string;
  features: string[];
}

export interface ProjectSpec {
  key: "hub" | "sds" | "ehs";
  code: string;
  name: string;
  description: string;
  website: string | null;
  platforms: string;
  overview: string;
  qaLead: string;
  pm: string;
  members: string[];
  modules: ModuleSpec[];
}

export const PROJECTS: ProjectSpec[] = [
  {
    key: "hub",
    code: "HUB",
    name: "HUB ONE",
    description: "Business suite: CRM, sales, support, meetings, ledger, Stride and quality in one place.",
    website: "https://hubone.example.com",
    platforms: "Web app (Chrome, Edge, Firefox, Safari)",
    overview:
      "HUB ONE is the company's all-in-one business platform. Sales and account teams use CRM to manage contacts, companies and leads; " +
      "Sales for deals, quotes and the pipeline; Support for customer tickets; Meetings for calendars and minutes; Ledger for invoices and payments; " +
      "Stride for goals and tasks; Quality for deviations and corrective actions. Records link across modules: a deal belongs to a company in CRM, " +
      "an invoice in Ledger comes from a won deal, and every call or meeting is logged on the contact's timeline.",
    qaLead: "nusrat",
    pm: "jonas",
    members: ["nusrat", "wahid", "tanvir", "sadia", "ingrid", "rafiq", "maria", "tahmid", "sabrina", "lars", "jonas", "hanne"],
    modules: [
      { key: "crm", name: "CRM", owner: "rafiq", description: "Contacts, companies, leads, activities and imports.", features: ["Contacts", "Companies", "Leads", "Activities", "Import & export", "Segments"] },
      { key: "sales", name: "Sales", owner: "maria", description: "Deals, pipeline, quotes and forecasts.", features: ["Pipeline", "Deals", "Quotes", "Forecast"] },
      { key: "support", name: "Support", owner: "tahmid", description: "Tickets, SLAs and the customer portal.", features: ["Tickets", "SLA", "Customer portal"] },
      { key: "meetings", name: "Meetings", owner: "sabrina", description: "Scheduling, calendar sync and minutes.", features: ["Calendar", "Scheduling", "Minutes"] },
      { key: "ledger", name: "Ledger", owner: "tahmid", description: "Invoices, payments and accounting exports.", features: ["Invoices", "Payments", "Accounting export"] },
      { key: "stride", name: "Stride", owner: "sabrina", description: "Goals, key results and tasks.", features: ["Goals", "Tasks"] },
      { key: "quality", name: "Quality", owner: "maria", description: "Deviations, corrective actions and document control.", features: ["Deviations", "Corrective actions", "Documents"] },
    ],
  },
  {
    key: "sds",
    code: "SDS",
    name: "SDS ONE",
    description: "Safety data sheets, chemical registers, the mobile app and the supplier portal.",
    website: "https://sdsone.example.com",
    platforms: "Web app, iOS and Android app, supplier portal",
    overview:
      "SDS ONE keeps a company's safety data sheets and chemical register up to date. SDS Hub stores and searches data sheets and their revisions; " +
      "Members and Sites control who works where; Reports produces the chemical register and exposure reports. The mobile app scans products on site " +
      "and works offline, and suppliers upload data sheets through the supplier portal.",
    qaLead: "nusrat",
    pm: "hanne",
    members: ["nusrat", "wahid", "tanvir", "sadia", "ingrid", "farhan", "lars", "imran", "maria", "sofie", "kamal", "erik", "jakob", "hanne", "jonas"],
    modules: [
      { key: "hub", name: "SDS Hub", owner: "lars", description: "Search, upload and track safety data sheets.", features: ["SDS search", "SDS upload", "Supplier requests", "Revision tracking"] },
      { key: "members", name: "Members", owner: "imran", description: "People, roles and site placements.", features: ["Edit member", "Invite member", "Roles & permissions", "Site placement"] },
      { key: "sites", name: "Sites", owner: "imran", description: "Sites, buildings and storage locations.", features: ["Site list", "Site hierarchy", "Location picker"] },
      { key: "settings", name: "Settings", owner: "lars", description: "Company profile and workspace settings.", features: ["Company profile", "Notifications", "Integrations", "Language"] },
      { key: "reports", name: "Reports", owner: null, description: "Registers, exposure reports and exports.", features: ["Chemical register export", "Exposure report", "Scheduled reports"] },
      { key: "dashboard", name: "Dashboard", owner: "lars", description: "Overview widgets and KPIs.", features: ["Widgets", "KPIs"] },
      { key: "mobile", name: "Mobile app", owner: "sofie", description: "Scanning, offline work and inventory on iOS and Android.", features: ["Barcode scan", "Label OCR", "Sync", "Cached SDS", "Inventory list", "Stock updates", "SSO", "Password reset"] },
      { key: "supplier", name: "Supplier portal", owner: "lars", description: "Where suppliers upload data sheets and manage products.", features: ["Bulk upload", "Validation", "Product search", "Product details", "Registration", "Company users"] },
    ],
  },
  {
    key: "ehs",
    code: "EHS",
    name: "EHS",
    description: "Environment, health and safety: incidents, risk assessments and audits.",
    website: "https://ehs.example.com",
    platforms: "Web app",
    overview:
      "EHS lets safety teams report incidents and near misses, run risk assessments with a configurable risk matrix, and carry out audits from " +
      "checklist templates. Reports can be exported to PDF, and actions from incidents and audits are followed up until they are closed.",
    qaLead: "nusrat",
    pm: "hanne",
    members: ["nusrat", "wahid", "tanvir", "sadia", "ingrid", "farhan", "lars", "imran", "hanne"],
    modules: [
      { key: "incidents", name: "Incidents", owner: "imran", description: "Incident and near-miss reports.", features: ["Incident reports"] },
      { key: "risk", name: "Risk assessments", owner: "imran", description: "Risk assessments and the risk matrix.", features: ["Risk assessments"] },
      { key: "audits", name: "Audits", owner: "lars", description: "Audit checklists and scores.", features: ["Audits"] },
    ],
  },
];
