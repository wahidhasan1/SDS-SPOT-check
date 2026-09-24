import { Camera, Sparkles } from "lucide-react";
import type { BugDetail } from "../../../core/api";
import { FREQUENCY_LABELS, type Provenance } from "../../../core/types";
import { useWorkspace } from "../../app/context";
import { AttachmentGrid } from "../../components/Attachments";
import { ProvenanceChip } from "../../components/badges";

function Prov({ detail, field }: { detail: BugDetail; field: string }) {
  const meta = detail.bug.ai_meta;
  if (!meta) return null;
  const src = meta.provenance[field] as Provenance | undefined;
  if (!src) return null;
  const edited = meta.edited_fields.includes(field);
  const confirmed = meta.confirmed_fields?.includes(field) ?? false;
  const label = src === "ai_inferred" ? (edited ? "AI-inferred" : confirmed ? "AI-inferred, confirmed by reporter" : "AI-inferred, not confirmed") : undefined;
  return (
    <span className="row" style={{ gap: 6 }}>
      <ProvenanceChip source={src} offline={meta.provider === "offline"} label={label} />
      {edited && <span className="tiny muted">edited by reporter</span>}
    </span>
  );
}

export function ReportCard({ detail }: { detail: BugDetail }) {
  const { lookup } = useWorkspace();
  const b = detail.bug;
  const env = lookup.environment(b.environment_id);
  const facts: [string, string | null][] = [
    ["Environment", env?.name ?? null],
    ["Browser", b.browser],
    ["Device", b.device],
    ["Operating system", b.os],
    ["App version / build", b.app_version],
    ["Frequency", b.frequency !== "unknown" ? FREQUENCY_LABELS[b.frequency] : null],
  ];
  const reportAtts = detail.attachments.filter((a) => a.context === "report");
  const meta = b.ai_meta;
  return (
    <section className="panel report">
      <div className="panel-body stack-lg">
        {meta && (
          <div className="ai-note">
            <Sparkles size={16} />
            <span>
              Drafted with the AI assistant ({meta.provider === "anthropic" ? `Claude${meta.model ? `, ${meta.model}` : ""}` : meta.provider === "artifact" ? "Claude" : "offline assistant"}) and reviewed by{" "}
              {lookup.userName(b.reporter_id)} before submitting.
              {meta.edited_fields.length > 0 && ` Edited after drafting: ${meta.edited_fields.map((f) => f.replace(/_/g, " ")).join(", ")}.`}
            </span>
          </div>
        )}
        {b.description && (
          <div className="stack-sm">
            <div className="row-between">
              <h3>Description</h3>
              <Prov detail={detail} field="description" />
            </div>
            <p className="prose">{b.description}</p>
          </div>
        )}
        <div className="stack-sm">
          <div className="row-between">
            <h3>Steps to reproduce</h3>
            <Prov detail={detail} field="steps" />
          </div>
          <ol className="steps">
            {b.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="expect-actual">
          <div className="ea expected">
            <div className="row-between">
              <span className="eyebrow">Expected result</span>
              <Prov detail={detail} field="expected_result" />
            </div>
            <p>{b.expected_result}</p>
          </div>
          <div className="ea actual">
            <div className="row-between">
              <span className="eyebrow">Actual result</span>
              <Prov detail={detail} field="actual_result" />
            </div>
            <p>{b.actual_result}</p>
          </div>
        </div>
        {meta && meta.screenshot_observations.length > 0 && (
          <div className="stack-sm">
            <h3 className="row" style={{ gap: 6 }}>
              <Camera size={15} /> What the assistant saw in the screenshots
            </h3>
            <ul className="observations">
              {meta.screenshot_observations.map((o, i) => (
                <li key={i}>
                  <span className="obs-kind">{o.kind.replace(/_/g, " ")}</span>
                  <span>
                    {o.observation}
                    {o.quote && <q>{o.quote}</q>}
                  </span>
                  <span className="tiny muted">image {o.image}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className={v ? "" : "muted"}>{v ?? "Not provided"}</dd>
            </div>
          ))}
          {b.page_url && (
            <div className="wide">
              <dt>Page URL</dt>
              <dd className="truncate">
                <span className="mono">{b.page_url}</span>
              </dd>
            </div>
          )}
        </dl>
        {b.notes && (
          <div className="stack-sm">
            <h3>Additional notes</h3>
            <p className="prose">{b.notes}</p>
          </div>
        )}
        {reportAtts.length > 0 && (
          <div className="stack-sm">
            <h3>Evidence from the report</h3>
            <AttachmentGrid attachments={reportAtts} />
          </div>
        )}
      </div>
    </section>
  );
}
