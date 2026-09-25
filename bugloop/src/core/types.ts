// Shared domain and API types. Used by the server, the in-browser demo backend and the UI.

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const ROLES = ["qa_analyst", "engineer", "qa_lead", "project_manager", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  qa_analyst: "QA Analyst",
  engineer: "Engineer",
  qa_lead: "QA Lead",
  project_manager: "Project Manager",
  admin: "Administrator",
};

export const QA_ROLES: readonly Role[] = ["qa_analyst", "qa_lead"];

export const STATUS_KEYS = [
  "new",
  "under_review",
  "in_progress",
  "need_info",
  "not_a_bug",
  "duplicate",
  "deferred",
  "fixed",
  "regression_required",
  "regression_failed",
  "verified",
  "closed",
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const FREQUENCIES = ["always", "often", "sometimes", "rarely", "once", "unknown"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  always: "Always (every attempt)",
  often: "Often",
  sometimes: "Sometimes",
  rarely: "Rarely",
  once: "Happened once",
  unknown: "Not checked yet",
};

export const REJECTION_CATEGORIES = [
  "works_as_designed",
  "cannot_reproduce",
  "configuration",
  "test_data",
  "third_party",
  "other",
] as const;
export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];
export const REJECTION_CATEGORY_LABELS: Record<RejectionCategory, string> = {
  works_as_designed: "Works as designed",
  cannot_reproduce: "Cannot reproduce",
  configuration: "Configuration or setup",
  test_data: "Test data issue",
  third_party: "Third-party behaviour",
  other: "Other",
};

export const ROOT_CAUSES = [
  "frontend",
  "backend",
  "data",
  "configuration",
  "third_party",
  "infrastructure",
  "unknown",
] as const;
export type RootCause = (typeof ROOT_CAUSES)[number];
export const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  frontend: "Frontend",
  backend: "Backend / API",
  data: "Data / migration",
  configuration: "Configuration",
  third_party: "Third party",
  infrastructure: "Infrastructure",
  unknown: "Unknown",
};

export const ENVIRONMENT_KINDS = ["development", "qa", "staging", "production", "other"] as const;
export type EnvironmentKind = (typeof ENVIRONMENT_KINDS)[number];

export const TEAM_KINDS = ["qa", "engineering", "product", "other"] as const;
export type TeamKind = (typeof TEAM_KINDS)[number];

export const COMMENT_KINDS = ["comment", "question", "answer", "dispute", "decision", "regression", "evidence"] as const;
export type CommentKind = (typeof COMMENT_KINDS)[number];

export const ATTACHMENT_CONTEXTS = ["report", "info", "regression", "comment"] as const;
export type AttachmentContext = (typeof ATTACHMENT_CONTEXTS)[number];

export const NOTIFICATION_CATEGORIES = ["action", "decision", "progress", "discussion"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Curated colour names. The UI maps each to light and dark tokens. */
export const PALETTE = [
  "slate",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "rose",
] as const;
export type PaletteColor = (typeof PALETTE)[number];

export type Provenance = "reporter" | "screenshot" | "ai_wording" | "ai_inferred";
export type SimilarityLevel = "high" | "medium" | "low";
export type Party = "engineering" | "qa" | "lead" | "nobody";

// ---------------------------------------------------------------------------
// Entities (the wire format mirrors the stored rows; secrets never leave the server)
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  progress: boolean;
  discussion: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team_id: string | null;
  title: string | null;
  avatar_color: PaletteColor;
  active: boolean;
  notification_prefs: NotificationPrefs;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  deactivated_at: string | null;
}

export interface Team {
  id: string;
  name: string;
  kind: TeamKind;
  lead_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  qa_lead_id: string | null;
  pm_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  joined_at: string;
  left_at: string | null;
}

export interface Module {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface Feature {
  id: string;
  module_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export const PAGE_IMPORTANCE = ["critical", "high", "normal", "low"] as const;
export type PageImportance = (typeof PAGE_IMPORTANCE)[number];

/**
 * One screen of the product, from the product map: where it lives, what is on it and how it must
 * behave. The assistant uses it to place a report precisely and to phrase the expected result.
 */
export interface Page {
  id: string;
  project_id: string;
  module_id: string;
  feature_id: string | null;
  name: string;
  path: string | null;
  description: string | null;
  /** Visible parts of the screen: fields, buttons, tables, dialogs. */
  elements: string[];
  /** How the screen must behave, in plain sentences. */
  rules: string[];
  /** Other words people use for this screen. */
  keywords: string[];
  importance: PageImportance;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** A rectangle on a screenshot, as fractions (0–1) of its width and height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where on screen the problem is. */
export interface BugLocation {
  /** The element, in words, e.g. "Role dropdown in the member form". */
  element: string | null;
  /** The report attachment the box is drawn on. */
  attachment_id: string | null;
  box: Box | null;
  source: Provenance;
}

export interface Environment {
  id: string;
  name: string;
  kind: EnvironmentKind;
  description: string | null;
  sort_order: number;
  active: boolean;
}

export interface Level {
  key: string;
  label: string;
  description: string | null;
  color: PaletteColor;
  rank: number;
  active: boolean;
}

export interface StatusConfig {
  key: StatusKey;
  label: string;
  description: string;
  color: PaletteColor;
  sort_order: number;
  enabled: boolean;
  attention_hours: number | null;
}

export interface ScreenshotObservation {
  image: number;
  kind: "error_message" | "ui_element" | "page" | "value" | "layout" | "validation" | "status" | "other";
  observation: string;
  quote: string | null;
}

export interface AiMeta {
  provider: string;
  model: string | null;
  drafted_fields: string[];
  provenance: Record<string, Provenance>;
  edited_fields: string[];
  /** AI-inferred fields the reporter explicitly confirmed before submitting. */
  confirmed_fields?: string[];
  screenshot_observations: ScreenshotObservation[];
  drafted_at: string;
}

export interface DuplicateCheck {
  checked_at: string;
  candidates: { bug_id: string; key: string; score: number; level: SimilarityLevel }[];
  decision: "none_found" | "submitted_anyway";
  note: string | null;
}

export interface DisputeContext {
  from: "not_a_bug" | "duplicate";
  reason: string;
  disputed_by_id: string;
  disputed_at: string;
  decided_by_id: string | null;
  resolution_reason: string | null;
  rejection_category: string | null;
  duplicate_of_id: string | null;
}

export interface Bug {
  id: string;
  number: number;
  key: string;
  project_id: string;
  module_id: string;
  feature_id: string | null;
  /** The screen from the product map, when known. */
  page_id: string | null;
  location: BugLocation | null;
  affected_module_ids: string[];

  title: string;
  description: string;
  steps: string[];
  expected_result: string;
  actual_result: string;
  environment_id: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;
  app_version: string | null;
  page_url: string | null;
  frequency: Frequency;
  severity: string;
  priority: string;
  tags: string[];
  notes: string | null;

  status: StatusKey;
  status_changed_at: string;
  info_return_status: StatusKey | null;
  info_requested_from_id: string | null;
  info_requested_by_id: string | null;

  reporter_id: string;
  assignee_id: string | null;
  collaborator_ids: string[];
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  confirmed_by_id: string | null;
  confirmed_at: string | null;
  first_response_at: string | null;
  fixed_by_id: string | null;
  fixed_at: string | null;
  fix_version: string | null;
  resolution_summary: string | null;
  root_cause: string | null;
  resolution_reason: string | null;
  rejection_category: string | null;
  duplicate_of_id: string | null;
  deferred_until: string | null;
  deferred_target: string | null;
  decision_by_id: string | null;
  decision_at: string | null;
  decision_acknowledged_at: string | null;
  disputed: boolean;
  dispute_context: DisputeContext | null;
  dispute_locked: boolean;
  verified_by_id: string | null;
  verified_at: string | null;
  closed_by_id: string | null;
  closed_at: string | null;
  close_reason: string | null;
  reopen_count: number;
  regression_round: number;

  ai_assisted: boolean;
  ai_meta: AiMeta | null;
  duplicate_check: DuplicateCheck | null;
  potential_duplicate_ids: string[];

  archived_at: string | null;
  archived_by_id: string | null;
  archive_reason: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
}

export interface Comment {
  id: string;
  bug_id: string;
  author_id: string;
  kind: CommentKind;
  body: string;
  mentions: string[];
  created_at: string;
  edited_at: string | null;
}

export interface Attachment {
  id: string;
  bug_id: string;
  comment_id: string | null;
  regression_run_id: string | null;
  uploader_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  context: AttachmentContext;
  created_at: string;
  /** Present in API responses. */
  url?: string;
}

export type RegressionResult = "pending" | "passed" | "failed" | "cancelled";

export interface RegressionRun {
  id: string;
  bug_id: string;
  round: number;
  assignee_id: string | null;
  requested_by_id: string | null;
  requested_at: string;
  environment_id: string | null;
  build: string | null;
  started_at: string | null;
  completed_at: string | null;
  completed_by_id: string | null;
  result: RegressionResult;
  notes: string | null;
}

export interface BugLink {
  id: string;
  bug_id: string;
  target_bug_id: string;
  kind: "duplicate_of" | "related";
  created_by_id: string | null;
  created_at: string;
}

export interface CoReporter {
  id: string;
  bug_id: string;
  user_id: string;
  via_bug_id: string | null;
  note: string | null;
  created_at: string;
}

export interface EventRecord {
  id: string;
  bug_id: string | null;
  actor_id: string | null;
  type: string;
  entity_type: string;
  entity_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  category: NotificationCategory;
  bug_id: string | null;
  actor_id: string | null;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

export interface WaitingOn {
  party: Party;
  user_id: string | null;
  label: string;
}

export interface BugRef {
  id: string;
  key: string;
  title: string;
  status: StatusKey;
  project_id: string;
  module_id: string;
  archived: boolean;
}

export type BugListItem = Pick<
  Bug,
  | "id"
  | "key"
  | "number"
  | "title"
  | "status"
  | "severity"
  | "priority"
  | "project_id"
  | "module_id"
  | "feature_id"
  | "affected_module_ids"
  | "environment_id"
  | "reporter_id"
  | "assignee_id"
  | "tags"
  | "reopen_count"
  | "disputed"
  | "potential_duplicate_ids"
  | "duplicate_of_id"
  | "ai_assisted"
  | "created_at"
  | "updated_at"
  | "status_changed_at"
  | "last_activity_at"
  | "closed_at"
  | "archived_at"
  | "decision_acknowledged_at"
> & {
  waiting_on: WaitingOn;
  overdue: boolean;
  hours_in_status: number;
  regression_assignee_id: string | null;
};

export interface SimilarBug {
  bug: BugRef & { severity: string; reporter_id: string; created_at: string; closed_at: string | null };
  score: number;
  level: SimilarityLevel;
  shared_terms: string[];
  same_module: boolean;
  same_feature: boolean;
  closed: boolean;
}

export interface PublicSettings {
  workspace_name: string;
  bug_prefix: string;
  auto_close_on_verify: boolean;
  escalate_after_reopens: number;
}

export interface AiStatus {
  available: boolean;
  provider: "anthropic" | "artifact" | "offline";
  label: string;
  model: string | null;
  vision: boolean;
}

export interface Workspace {
  mode: "server" | "demo";
  demo_login: boolean;
  me: User;
  users: User[];
  teams: Team[];
  projects: Project[];
  project_members: ProjectMember[];
  modules: Module[];
  features: Feature[];
  pages: Page[];
  environments: Environment[];
  severities: Level[];
  priorities: Level[];
  statuses: StatusConfig[];
  settings: PublicSettings;
  ai: AiStatus;
  capabilities: WorkspaceCapabilities;
}

export interface WorkspaceCapabilities {
  report: boolean;
  view_team_analytics: boolean;
  manage_projects: boolean;
  /** Edit the product map (pages, paths, elements, rules). */
  manage_product_map: boolean;
  manage_users: boolean;
  manage_config: boolean;
  view_audit: boolean;
  assign: boolean;
  qa: boolean;
  engineering: boolean;
}
