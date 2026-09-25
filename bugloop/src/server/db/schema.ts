// Declarative schema. The SQLite DDL and the in-memory tables are both generated from it.

import type {
  Attachment,
  Bug,
  BugLink,
  Comment,
  CoReporter,
  Environment,
  EventRecord,
  Feature,
  Level,
  Module,
  Notification,
  Project,
  ProjectMember,
  RegressionRun,
  StatusConfig,
  Team,
  User,
  Page,
} from "../../core/types";

export type ColumnType = "text" | "integer" | "real" | "boolean" | "json";

export interface ColumnDef {
  type: ColumnType;
  nullable?: boolean;
  unique?: boolean;
  references?: string;
}

export interface TableDef {
  pk: string;
  columns: Record<string, ColumnDef>;
  indexes?: { columns: string[]; unique?: boolean }[];
}

// Row types that carry server-only fields.
export interface UserRow extends User {
  password_hash: string | null;
}
export interface AttachmentRow extends Omit<Attachment, "url"> {
  storage_key: string;
  width: number | null;
  height: number | null;
}
export interface Watcher {
  id: string;
  bug_id: string;
  user_id: string;
  created_at: string;
}
export interface SessionRow {
  id: string;
  token_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_used_at: string;
}
export interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by_id: string | null;
}
export interface SequenceRow {
  name: string;
  value: number;
}
export interface AiRequestRow {
  id: string;
  user_id: string | null;
  feature: string;
  provider: string;
  model: string | null;
  status: "ok" | "error" | "refused";
  duration_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  error: string | null;
  created_at: string;
}

export interface Tables {
  users: UserRow;
  teams: Team;
  projects: Project;
  project_members: ProjectMember;
  modules: Module;
  features: Feature;
  pages: Page;
  environments: Environment;
  severity_levels: Level;
  priority_levels: Level;
  status_config: StatusConfig;
  bugs: Bug;
  comments: Comment;
  attachments: AttachmentRow;
  regression_runs: RegressionRun;
  bug_links: BugLink;
  co_reporters: CoReporter;
  watchers: Watcher;
  events: EventRecord;
  notifications: Notification;
  sessions: SessionRow;
  settings: SettingRow;
  sequences: SequenceRow;
  ai_requests: AiRequestRow;
}

export type TableName = keyof Tables;

const t = (type: ColumnType, extra: Omit<ColumnDef, "type"> = {}): ColumnDef => ({ type, ...extra });
const text = t("text");
const textN = t("text", { nullable: true });
const int = t("integer");
const intN = t("integer", { nullable: true });
const bool = t("boolean");
const json = t("json");
const jsonN = t("json", { nullable: true });
const ref = (table: string, nullable = true): ColumnDef => ({ type: "text", nullable, references: table });

const levelTable: TableDef = {
  pk: "key",
  columns: { key: text, label: text, description: textN, color: text, rank: int, active: bool },
};

export const SCHEMA: Record<TableName, TableDef> = {
  users: {
    pk: "id",
    columns: {
      id: text,
      name: text,
      email: t("text", { unique: true }),
      password_hash: textN,
      role: text,
      team_id: ref("teams"),
      title: textN,
      avatar_color: text,
      active: bool,
      notification_prefs: json,
      created_at: text,
      updated_at: text,
      last_seen_at: textN,
      deactivated_at: textN,
    },
  },
  teams: {
    pk: "id",
    columns: {
      id: text,
      name: text,
      kind: text,
      lead_id: ref("users"),
      description: textN,
      created_at: text,
    },
  },
  projects: {
    pk: "id",
    columns: {
      id: text,
      key: t("text", { unique: true }),
      name: text,
      description: textN,
      qa_lead_id: ref("users"),
      pm_id: ref("users"),
      archived: bool,
      created_at: text,
      updated_at: text,
    },
  },
  project_members: {
    pk: "id",
    columns: {
      id: text,
      project_id: ref("projects", false),
      user_id: ref("users", false),
      joined_at: text,
      left_at: textN,
    },
    indexes: [{ columns: ["project_id"] }, { columns: ["user_id"] }],
  },
  modules: {
    pk: "id",
    columns: {
      id: text,
      project_id: ref("projects", false),
      name: text,
      description: textN,
      owner_id: ref("users"),
      sort_order: int,
      archived: bool,
      created_at: text,
    },
    indexes: [{ columns: ["project_id"] }],
  },
  features: {
    pk: "id",
    columns: {
      id: text,
      module_id: ref("modules", false),
      name: text,
      description: textN,
      sort_order: int,
      archived: bool,
      created_at: text,
    },
    indexes: [{ columns: ["module_id"] }],
  },
  pages: {
    pk: "id",
    columns: {
      id: text,
      project_id: ref("projects", false),
      module_id: ref("modules", false),
      feature_id: ref("features"),
      name: text,
      path: textN,
      description: textN,
      elements: json,
      rules: json,
      keywords: json,
      importance: text,
      archived: bool,
      created_at: text,
      updated_at: text,
    },
    indexes: [{ columns: ["project_id"] }, { columns: ["module_id"] }],
  },
  environments: {
    pk: "id",
    columns: {
      id: text,
      name: text,
      kind: text,
      description: textN,
      sort_order: int,
      active: bool,
    },
  },
  severity_levels: levelTable,
  priority_levels: levelTable,
  status_config: {
    pk: "key",
    columns: {
      key: text,
      label: text,
      description: text,
      color: text,
      sort_order: int,
      enabled: bool,
      attention_hours: intN,
    },
  },
  bugs: {
    pk: "id",
    columns: {
      id: text,
      number: t("integer", { unique: true }),
      key: t("text", { unique: true }),
      project_id: ref("projects", false),
      module_id: ref("modules", false),
      feature_id: ref("features"),
      page_id: ref("pages"),
      location: jsonN,
      affected_module_ids: json,
      title: text,
      description: text,
      steps: json,
      expected_result: text,
      actual_result: text,
      environment_id: ref("environments"),
      browser: textN,
      device: textN,
      os: textN,
      app_version: textN,
      page_url: textN,
      frequency: text,
      severity: text,
      priority: text,
      tags: json,
      notes: textN,
      status: text,
      status_changed_at: text,
      info_return_status: textN,
      info_requested_from_id: ref("users"),
      info_requested_by_id: ref("users"),
      reporter_id: ref("users", false),
      assignee_id: ref("users"),
      collaborator_ids: json,
      reviewed_by_id: ref("users"),
      reviewed_at: textN,
      confirmed_by_id: ref("users"),
      confirmed_at: textN,
      first_response_at: textN,
      fixed_by_id: ref("users"),
      fixed_at: textN,
      fix_version: textN,
      resolution_summary: textN,
      root_cause: textN,
      resolution_reason: textN,
      rejection_category: textN,
      duplicate_of_id: ref("bugs"),
      deferred_until: textN,
      deferred_target: textN,
      decision_by_id: ref("users"),
      decision_at: textN,
      decision_acknowledged_at: textN,
      disputed: bool,
      dispute_context: jsonN,
      dispute_locked: bool,
      verified_by_id: ref("users"),
      verified_at: textN,
      closed_by_id: ref("users"),
      closed_at: textN,
      close_reason: textN,
      reopen_count: int,
      regression_round: int,
      ai_assisted: bool,
      ai_meta: jsonN,
      duplicate_check: jsonN,
      potential_duplicate_ids: json,
      archived_at: textN,
      archived_by_id: ref("users"),
      archive_reason: textN,
      created_at: text,
      updated_at: text,
      last_activity_at: text,
    },
    indexes: [
      { columns: ["status"] },
      { columns: ["project_id", "status"] },
      { columns: ["assignee_id", "status"] },
      { columns: ["reporter_id"] },
      { columns: ["module_id"] },
      { columns: ["updated_at"] },
    ],
  },
  comments: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs", false),
      author_id: ref("users", false),
      kind: text,
      body: text,
      mentions: json,
      created_at: text,
      edited_at: textN,
    },
    indexes: [{ columns: ["bug_id"] }],
  },
  attachments: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs", false),
      comment_id: ref("comments"),
      regression_run_id: ref("regression_runs"),
      uploader_id: ref("users", false),
      filename: text,
      mime_type: text,
      size_bytes: int,
      storage_key: text,
      context: text,
      width: intN,
      height: intN,
      created_at: text,
    },
    indexes: [{ columns: ["bug_id"] }],
  },
  regression_runs: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs", false),
      round: int,
      assignee_id: ref("users"),
      requested_by_id: ref("users"),
      requested_at: text,
      environment_id: ref("environments"),
      build: textN,
      started_at: textN,
      completed_at: textN,
      completed_by_id: ref("users"),
      result: text,
      notes: textN,
    },
    indexes: [{ columns: ["bug_id"] }, { columns: ["assignee_id", "result"] }],
  },
  bug_links: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs", false),
      target_bug_id: ref("bugs", false),
      kind: text,
      created_by_id: ref("users"),
      created_at: text,
    },
    indexes: [{ columns: ["bug_id"] }, { columns: ["target_bug_id"] }],
  },
  co_reporters: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs", false),
      user_id: ref("users", false),
      via_bug_id: ref("bugs"),
      note: textN,
      created_at: text,
    },
    indexes: [{ columns: ["bug_id"] }, { columns: ["user_id"] }],
  },
  watchers: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs", false),
      user_id: ref("users", false),
      created_at: text,
    },
    indexes: [{ columns: ["bug_id", "user_id"], unique: true }, { columns: ["user_id"] }],
  },
  events: {
    pk: "id",
    columns: {
      id: text,
      bug_id: ref("bugs"),
      actor_id: ref("users"),
      type: text,
      entity_type: text,
      entity_id: textN,
      data: json,
      created_at: text,
    },
    indexes: [{ columns: ["bug_id", "created_at"] }, { columns: ["created_at"] }, { columns: ["type"] }],
  },
  notifications: {
    pk: "id",
    columns: {
      id: text,
      user_id: ref("users", false),
      type: text,
      category: text,
      bug_id: ref("bugs"),
      actor_id: ref("users"),
      title: text,
      body: textN,
      created_at: text,
      read_at: textN,
    },
    indexes: [{ columns: ["user_id", "created_at"] }],
  },
  sessions: {
    pk: "id",
    columns: {
      id: text,
      token_hash: t("text", { unique: true }),
      user_id: ref("users", false),
      created_at: text,
      expires_at: text,
      last_used_at: text,
    },
    indexes: [{ columns: ["user_id"] }],
  },
  settings: {
    pk: "key",
    columns: { key: text, value: json, updated_at: text, updated_by_id: ref("users") },
  },
  sequences: {
    pk: "name",
    columns: { name: text, value: int },
  },
  ai_requests: {
    pk: "id",
    columns: {
      id: text,
      user_id: ref("users"),
      feature: text,
      provider: text,
      model: textN,
      status: text,
      duration_ms: int,
      input_tokens: intN,
      output_tokens: intN,
      error: textN,
      created_at: text,
    },
    indexes: [{ columns: ["created_at"] }],
  },
};

export const TABLE_NAMES = Object.keys(SCHEMA) as TableName[];

/** SQLite DDL generated from the schema. */
export function schemaDDL(): string {
  const parts: string[] = [];
  for (const name of TABLE_NAMES) {
    const def = SCHEMA[name];
    const cols = Object.entries(def.columns).map(([col, c]) => {
      const sqlType = c.type === "json" || c.type === "text" ? "TEXT" : c.type === "real" ? "REAL" : "INTEGER";
      let line = `  "${col}" ${sqlType}`;
      if (col === def.pk) line += " PRIMARY KEY";
      else if (!c.nullable) line += " NOT NULL";
      if (c.unique) line += " UNIQUE";
      if (c.references) line += ` REFERENCES "${c.references}"(id) DEFERRABLE INITIALLY DEFERRED`;
      return line;
    });
    parts.push(`CREATE TABLE IF NOT EXISTS "${name}" (\n${cols.join(",\n")}\n);`);
    for (const idx of def.indexes ?? []) {
      const idxName = `idx_${name}_${idx.columns.join("_")}`;
      parts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS "${idxName}" ON "${name}" (${idx.columns.map((c) => `"${c}"`).join(", ")});`,
      );
    }
  }
  return parts.join("\n");
}
