import { useState } from "react";
import { Camera, MapPin, PenLine, Sparkles } from "lucide-react";
import type { BugDetail } from "../../../core/api";
import { FREQUENCY_LABELS, type Attachment, type Box, type Provenance } from "../../../core/types";
import { useWorkspace } from "../../app/context";
import { useMutate } from "../../api/hooks";
import { AttachmentGrid, useFileUrl } from "../../components/Attachments";
import { ScreenshotMarker } from "../../components/ScreenshotMarker";
import { Dialog, Field } from "../../components/ui";
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
        <WhereBlock detail={detail} />
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

function MarkedShot({ att, box, label, onChange }: { att: Attachment; box: Box | null; label: string | null; onChange?: (b: Box | null) => void }) {
  const url = useFileUrl(att);
  return <ScreenshotMarker src={url} alt={att.filename} box={box} label={label} onChange={onChange} />;
}

/** Where the problem is: the screen from the product map and the spot on the screenshot. */
function WhereBlock({ detail }: { detail: BugDetail }) {
  const { ws, lookup } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const b = detail.bug;
  const page = b.page_id ? ws.pages.find((p) => p.id === b.page_id) ?? null : null;
  const loc = b.location;
  const shotAtt = loc?.attachment_id ? detail.attachments.find((a) => a.id === loc.attachment_id) ?? null : null;
  const canEdit = detail.permissions.editable_fields.includes("location");
  const feat = lookup.feature(b.feature_id);
  return (
    <div className="stack-sm where-block">
      <div className="row-between">
        <h3 className="row" style={{ gap: 6 }}>
          <MapPin size={15} /> Where
        </h3>
        <span className="row" style={{ gap: 6 }}>
          <Prov detail={detail} field="where" />
          {canEdit && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              <PenLine /> Edit location
            </button>
          )}
        </span>
      </div>
      <div className="where-line">
        <span>
          {lookup.project(b.project_id)?.name} › {lookup.module(b.module_id)?.name}
          {feat ? ` › ${feat.name}` : ""}
        </span>
        {page && (
          <span className="small secondary">
            Page: <strong>{page.name}</strong>
            {page.path && <span className="mono muted"> {page.path}</span>}
          </span>
        )}
      </div>
      {loc && (
        <div className="stack-sm">
          {loc.element && (
            <div className="row-wrap small">
              <span className="muted">On screen:</span> <strong>{loc.element}</strong>
              <Prov detail={detail} field="location" />
            </div>
          )}
          {shotAtt && loc.box && <MarkedShot att={shotAtt} box={loc.box} label={loc.element} />}
        </div>
      )}
      {editing && <LocationDialog detail={detail} onClose={() => setEditing(false)} />}
    </div>
  );
}

function LocationDialog({ detail, onClose }: { detail: BugDetail; onClose: () => void }) {
  const { ws } = useWorkspace();
  const b = detail.bug;
  const images = detail.attachments.filter((a) => a.context === "report" && a.mime_type.startsWith("image/"));
  const pages = ws.pages.filter((p) => p.module_id === b.module_id && !p.archived);
  const [pageId, setPageId] = useState(b.page_id ?? "");
  const [element, setElement] = useState(b.location?.element ?? "");
  const [attId, setAttId] = useState(b.location?.attachment_id ?? images[0]?.id ?? "");
  const [box, setBox] = useState<Box | null>(b.location?.box ?? null);
  const page = pages.find((p) => p.id === pageId) ?? null;
  const att = images.find((a) => a.id === attId) ?? null;
  const save = useMutate(
    (api) =>
      api.patch(`/bugs/${b.key}`, {
        fields: {
          ...(pageId !== (b.page_id ?? "") && detail.permissions.editable_fields.includes("page_id") ? { page_id: pageId || null } : {}),
          location: element.trim() || box ? { element: element.trim() || null, attachment_id: box ? attId : null, box, source: "reporter" } : null,
        },
      }),
    { success: "Location updated" },
  );
  return (
    <Dialog
      title="Where is the problem?"
      description="Correct the screen and the spot on the screenshot. Changes are recorded in the history."
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: onClose })}>
            Save location
          </button>
        </>
      }
    >
      <div className="grid-2">
        <Field label="Page" htmlFor="loc-page">
          <select id="loc-page" className="select" value={pageId} onChange={(e) => setPageId(e.target.value)} disabled={!pages.length}>
            <option value="">{pages.length ? "Not specified" : "No pages mapped for this module"}</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.path ? ` (${p.path})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Element" htmlFor="loc-el">
          <input id="loc-el" className="input" list="loc-elements" value={element} onChange={(e) => setElement(e.target.value)} placeholder="e.g. Role dropdown" />
          <datalist id="loc-elements">
            {(page?.elements ?? []).map((el) => (
              <option key={el} value={el} />
            ))}
          </datalist>
        </Field>
      </div>
      {images.length > 1 && (
        <div className="row-wrap">
          {images.map((a, i) => (
            <button key={a.id} type="button" className={`chip choice${a.id === attId ? " accent" : ""}`} onClick={() => { setAttId(a.id); if (a.id !== attId) setBox(null); }}>
              Screenshot {i + 1}
            </button>
          ))}
        </div>
      )}
      {att ? <MarkedShot att={att} box={box} label={element || null} onChange={setBox} /> : <p className="small muted">This report has no screenshot to mark.</p>}
    </Dialog>
  );
}
