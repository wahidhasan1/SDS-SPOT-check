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
  { key: "qa", name: "QA", kind: "qa", lead: "nusrat", description: "Quality assurance for web, mobile and supplier products." },
  { key: "platform", name: "Platform Engineering", kind: "engineering", lead: "lars", description: "SDS Manager web app and APIs." },
  { key: "mobile", name: "Mobile Engineering", kind: "engineering", lead: "sofie", description: "iOS and Android apps." },
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
  { key: "rafiq", name: "Rafiq Chowdhury", role: "engineer", team: "platform", title: "Backend Engineer" },
  { key: "maria", name: "Maria Olsen", role: "engineer", team: "platform", title: "Full-stack Engineer" },
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
  key: string;
  code: string;
  name: string;
  description: string;
  qaLead: string;
  pm: string;
  members: string[];
  modules: ModuleSpec[];
}

export const PROJECTS: ProjectSpec[] = [
  {
    key: "sds",
    code: "SDS",
    name: "SDS Manager",
    description: "Web application for managing safety data sheets, chemical registers and EHS work.",
    qaLead: "nusrat",
    pm: "hanne",
    members: ["nusrat", "wahid", "tanvir", "sadia", "ingrid", "farhan", "lars", "rafiq", "maria", "imran", "erik", "jakob", "hanne"],
    modules: [
      { key: "ehs", name: "EHS", owner: "imran", description: "Incidents, risk assessments and audits.", features: ["Incident reports", "Risk assessments", "Audits"] },
      { key: "hub", name: "SDS Hub", owner: "maria", description: "Search, upload and track safety data sheets.", features: ["SDS search", "SDS upload", "Supplier requests", "Revision tracking"] },
      { key: "members", name: "Members", owner: "rafiq", description: "People, roles and site placements.", features: ["Edit member", "Invite member", "Roles & permissions", "Site placement"] },
      { key: "sites", name: "Sites", owner: "rafiq", description: "Sites, buildings and storage locations.", features: ["Site list", "Site hierarchy", "Location picker"] },
      { key: "settings", name: "Settings", owner: "lars", description: "Company profile and workspace settings.", features: ["Company profile", "Notifications", "Integrations", "Language"] },
      { key: "reports", name: "Reports", owner: null, description: "Registers, exposure reports and exports.", features: ["Chemical register export", "Exposure report", "Scheduled reports"] },
      { key: "dashboard", name: "Dashboard", owner: "lars", description: "Overview widgets and KPIs.", features: ["Widgets", "KPIs"] },
    ],
  },
  {
    key: "mob",
    code: "MOB",
    name: "SDS Manager Mobile",
    description: "iOS and Android app for scanning products and working offline on site.",
    qaLead: "nusrat",
    pm: "jonas",
    members: ["nusrat", "wahid", "sadia", "ingrid", "sofie", "kamal", "erik", "jonas"],
    modules: [
      { key: "scanner", name: "Scanner", owner: "sofie", description: "Barcode and label scanning.", features: ["Barcode scan", "Label OCR"] },
      { key: "offline", name: "Offline mode", owner: "kamal", description: "Sync and cached documents.", features: ["Sync", "Cached SDS"] },
      { key: "inventory", name: "Chemical inventory", owner: "erik", description: "Stock and inventory on the go.", features: ["Inventory list", "Stock updates"] },
      { key: "login", name: "Login & onboarding", owner: "kamal", description: "Sign-in, SSO and first-run.", features: ["SSO", "Password reset"] },
    ],
  },
  {
    key: "sup",
    code: "SUP",
    name: "Supplier Portal",
    description: "Portal where suppliers upload SDS documents and manage product data.",
    qaLead: "nusrat",
    pm: "jonas",
    members: ["nusrat", "tanvir", "wahid", "ingrid", "lars", "imran", "maria", "jonas"],
    modules: [
      { key: "upload", name: "Document upload", owner: "imran", description: "Single and bulk SDS upload.", features: ["Bulk upload", "Validation"] },
      { key: "catalogue", name: "Product catalogue", owner: "maria", description: "Supplier products and variants.", features: ["Product search", "Product details"] },
      { key: "account", name: "Account", owner: "lars", description: "Registration and company users.", features: ["Registration", "Company users"] },
    ],
  },
];
