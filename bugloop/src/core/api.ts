// Response shapes of the HTTP API, shared by the server and the UI.

import type {
  Attachment,
  Bug,
  BugListItem,
  BugRef,
  Comment,
  CoReporter,
  EventRecord,
  Frequency,
  Notification,
  Provenance,
  RegressionRun,
  ScreenshotObservation,
  StatusKey,
  User,
  WaitingOn,
} from "./types";
import type { ActionKey } from "./workflow";
import type { FieldChangeRule, ReportField } from "./permissions";

export interface BugPermissions {
  editable_fields: ReportField[];
  severity: FieldChangeRule;
  priority: FieldChangeRule;
  can_assign: boolean;
  can_reassign_regression: boolean;
  can_comment: boolean;
  can_also_see: boolean;
  can_link: boolean;
}

export interface BugLinkView {
  id: string;
  kind: "duplicate_of" | "related";
  direction: "outgoing" | "incoming";
  bug: BugRef;
}

export interface BugDetail {
  bug: Bug;
  waiting_on: WaitingOn;
  overdue: boolean;
  hours_in_status: number;
  actions: ActionKey[];
  hints: string[];
  permissions: BugPermissions;
  comments: Comment[];
  attachments: Attachment[];
  events: EventRecord[];
  regression_runs: RegressionRun[];
  links: BugLinkView[];
  duplicate_of: BugRef | null;
  duplicates: BugRef[];
  potential_duplicates: BugRef[];
  co_reporters: CoReporter[];
  watchers: string[];
  is_watching: boolean;
  /** Bugs referenced from events and dispute context, for rendering the timeline. */
  referenced_bugs: BugRef[];
}

export interface BugListResponse {
  items: BugListItem[];
  total: number;
  page: number;
  page_size: number;
}

export type ActionItemKind =
  | "answer_question"
  | "run_regression"
  | "review_decision"
  | "triage"
  | "work"
  | "reopened"
  | "info_received"
  | "make_testable"
  | "dispute"
  | "assign_regression"
  | "reassign"
  | "revisit"
  | "close_verified";

export interface ActionItem {
  kind: ActionItemKind;
  label: string;
  detail: string;
  since: string;
  bug: BugListItem;
}

export interface ActionItemsResponse {
  items: ActionItem[];
  counts: Record<string, number>;
}

export interface RegressionQueueItem {
  run: RegressionRun;
  bug: BugListItem;
  fixed_by_id: string | null;
  fix_version: string | null;
  resolution_summary: string | null;
}

export interface NotificationsResponse {
  items: Notification[];
  unread: number;
}

export interface ViewCounts {
  action_items: number;
  my_regression: number;
  unread_notifications: number;
  assigned: number;
  mine_open: number;
}

// ---------------------------------------------------------------------------
// Dashboard and analytics
// ---------------------------------------------------------------------------

export interface WeeklyPoint {
  week: string; // ISO date of the Monday
  reported: number;
  resolved: number;
}

export interface DashboardResponse {
  generated_at: string;
  scope: { project_id: string | null; days: number };
  status_counts: Record<StatusKey, number>;
  overdue_counts: Partial<Record<StatusKey, number>>;
  open_total: number;
  weekly: WeeklyPoint[];
  by_module: { module_id: string; open: number; reopened: number; high_severity: number }[];
  by_severity: { severity: string; open: number }[];
  time_in_status: { status: StatusKey; avg_hours: number; count: number }[];
  oldest_waiting: BugListItem[];
  metrics: {
    median_hours_to_first_response: number | null;
    median_hours_to_fix: number | null;
    median_hours_to_close: number | null;
    reopen_rate: number | null;
    valid_report_rate: number | null;
    regression_pass_rate: number | null;
    reported_in_period: number;
    closed_in_period: number;
  };
  my_reports?: { status: StatusKey; count: number }[];
  my_assigned?: { status: StatusKey; count: number }[];
}

export interface PersonStats {
  user_id: string;
  reported: number;
  fixed: number;
  open: number;
  not_a_bug: number;
  duplicate: number;
  reopened: number;
  verified: number;
  avg_hours_to_resolution: number | null;
  co_reported: number;
  regressions_run: number;
}

export interface ContributionsResponse {
  weeks: string[];
  series: { user_id: string; counts: number[] }[];
  people: PersonStats[];
  scope: "team" | "self";
}

export interface EngineeringPerson {
  user_id: string;
  assigned_open: number;
  in_progress: number;
  waiting_on_qa: number;
  fixed_in_period: number;
  reopened_after_fix: number;
  median_hours_to_fix: number | null;
  median_hours_to_first_response: number | null;
}

export interface EngineeringResponse {
  people: EngineeringPerson[];
  unassigned_open: number;
  regression_pass_rate: number | null;
  scope: "team" | "self";
}

export interface ModuleHealth {
  module_id: string;
  project_id: string;
  open: number;
  total: number;
  reopened: number;
  reopen_rate: number | null;
  not_a_bug: number;
  median_hours_to_close: number | null;
  recurring_concepts: { concept: string; count: number }[];
}

export interface ModulesResponse {
  modules: ModuleHealth[];
}

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

export interface Sourced<T = string> {
  value: T;
  source: Provenance;
}

export interface DraftResult {
  provider: "anthropic" | "artifact" | "offline";
  model: string | null;
  title: Sourced | null;
  description: Sourced | null;
  steps: Sourced[];
  expected_result: Sourced | null;
  actual_result: Sourced | null;
  module_id: Sourced | null;
  feature_id: Sourced | null;
  environment_id: Sourced | null;
  browser: Sourced | null;
  device: Sourced | null;
  os: Sourced | null;
  app_version: Sourced | null;
  page_url: Sourced | null;
  frequency: Sourced<Frequency> | null;
  severity_suggestion: { key: string; rationale: string } | null;
  screenshot_observations: ScreenshotObservation[];
  missing_information: { field: string; question: string }[];
  notes: string[];
  removed_by_guardrail: { field: string; value: string }[];
  images_analyzed: number;
}

export interface SummaryResult {
  provider: DraftResult["provider"];
  model: string | null;
  summary: string;
  current_state: string;
  open_questions: string[];
  next_step: string;
}

export interface RegressionChecksResult {
  provider: DraftResult["provider"];
  model: string | null;
  checks: { title: string; steps: string[]; why: string }[];
}

export interface ReleaseRiskResult {
  provider: DraftResult["provider"];
  model: string | null;
  headline: string;
  risks: { bug_key: string; risk: string }[];
  recommendation: string;
  facts: { open: number; critical_open: number; reopened_open: number; overdue: number; unassigned: number };
}

export interface AuthStatus {
  mode: "server" | "demo";
  demo_login: boolean;
  needs_setup: boolean;
  workspace_name: string;
  demo_accounts: Pick<User, "id" | "name" | "role" | "title" | "avatar_color">[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AuditResponse {
  items: EventRecord[];
  total: number;
  page: number;
  page_size: number;
  bugs: BugRef[];
}
