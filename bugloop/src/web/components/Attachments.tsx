import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Film, ImagePlus, Paperclip, X } from "lucide-react";
import type { Attachment } from "../../core/types";
import { useApi, useWorkspace } from "../app/context";
import { dateTime, formatBytes } from "../lib/format";
import { cx } from "./ui";

export function useFileUrl(att: Pick<Attachment, "id" | "url"> | null): string | null {
  const api = useApi();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!att) return;
    let alive = true;
    api.fileUrl(att).then(
      (u) => alive && setUrl(u),
      () => alive && setUrl(null),
    );
    return () => {
      alive = false;
    };
  }, [api, att?.id, att?.url]);
  return url;
}

const CONTEXT_LABEL: Record<Attachment["context"], string> = {
  report: "Original report",
  info: "Information response",
  regression: "Regression evidence",
  comment: "Comment",
};

function isImage(a: Attachment) {
  return a.mime_type.startsWith("image/");
}
function isVideo(a: Attachment) {
  return a.mime_type.startsWith("video/");
}

export function AttachmentThumb({ att, onOpen, size = "md" }: { att: Attachment; onOpen: () => void; size?: "sm" | "md" }) {
  const url = useFileUrl(isImage(att) || isVideo(att) ? att : null);
  return (
    <button className={cx("att-thumb", size)} onClick={onOpen} title={`${att.filename} · ${formatBytes(att.size_bytes)}`}>
      <span className="att-media">
        {isImage(att) && url ? <img src={url} alt={att.filename} loading="lazy" /> : isVideo(att) ? <Film /> : isImage(att) ? <span className="spinner" /> : <FileText />}
      </span>
      <span className="att-name truncate">{att.filename}</span>
    </button>
  );
}

export function AttachmentGrid({ attachments, size }: { attachments: Attachment[]; size?: "sm" | "md" }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!attachments.length) return null;
  return (
    <>
      <div className={cx("att-grid", size)}>
        {attachments.map((a, i) => (
          <AttachmentThumb key={a.id} att={a} onOpen={() => setOpen(i)} size={size} />
        ))}
      </div>
      {open !== null && <Lightbox attachments={attachments} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string>("Loading…");
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then((t) => setText(t.slice(0, 20000)))
      .catch(() => setText("Preview unavailable."));
  }, [url]);
  return <pre className="text-preview">{text}</pre>;
}

export function Lightbox({ attachments, index, onClose, onIndex }: { attachments: Attachment[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const att = attachments[index];
  const api = useApi();
  const { lookup } = useWorkspace();
  const url = useFileUrl(att);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < attachments.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, attachments.length, onClose, onIndex]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={att.filename} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lightbox-bar">
        <div className="stack-sm" style={{ gap: 0, minWidth: 0 }}>
          <strong className="truncate">{att.filename}</strong>
          <span className="tiny">
            {CONTEXT_LABEL[att.context]} · {lookup.userName(att.uploader_id)} · {dateTime(att.created_at)} · {formatBytes(att.size_bytes)}
          </span>
        </div>
        <div className="row">
          {api.mode === "server" && url && (
            <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">
              Open original
            </a>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close preview">
            <X />
          </button>
        </div>
      </div>
      <div className="lightbox-stage">
        {index > 0 && (
          <button className="icon-btn lb-nav left" onClick={() => onIndex(index - 1)} aria-label="Previous">
            <ChevronLeft />
          </button>
        )}
        {!url ? (
          <span className="spinner" />
        ) : isImage(att) ? (
          <img src={url} alt={att.filename} />
        ) : isVideo(att) ? (
          <video src={url} controls autoPlay={false} />
        ) : att.mime_type.startsWith("text/") || att.mime_type === "application/json" ? (
          <TextPreview url={url} />
        ) : (
          <div className="empty" style={{ color: "#fff" }}>
            <FileText />
            <div>No preview for this file type.</div>
          </div>
        )}
        {index < attachments.length - 1 && (
          <button className="icon-btn lb-nav right" onClick={() => onIndex(index + 1)} aria-label="Next">
            <ChevronRight />
          </button>
        )}
      </div>
    </div>
  );
}

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,text/plain,application/json,application/pdf,.log,.har,.txt,.csv";

/** File picker with drag-and-drop and clipboard paste (for screenshots). */
export function FileDrop({
  files,
  onChange,
  label = "Add screenshots, recordings or logs",
  hint = "Drop files here, paste a screenshot, or click to browse. Up to 10 files.",
  imagesOnly,
  compact,
  pasteTarget,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  label?: string;
  hint?: string;
  imagesOnly?: boolean;
  compact?: boolean;
  pasteTarget?: "document" | "none";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const add = (list: FileList | File[]) => {
    const incoming = Array.from(list).filter((f) => !imagesOnly || f.type.startsWith("image/"));
    if (incoming.length) onChange([...files, ...incoming].slice(0, 10));
  };
  useEffect(() => {
    if (pasteTarget !== "document") return;
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.files ?? []);
      if (items.length) {
        e.preventDefault();
        add(items.map((f, i) => (f.name && f.name !== "image.png" ? f : new File([f], `pasted-screenshot-${Date.now()}-${i + 1}.png`, { type: f.type }))));
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });
  return (
    <div className="stack-sm">
      <div
        className={cx("dropzone", drag && "drag", compact && "compact")}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      >
        {compact ? <Paperclip /> : <ImagePlus />}
        <span className="stack-sm" style={{ gap: 0 }}>
          <span className="dz-title">{label}</span>
          {!compact && <span className="dz-hint">{hint}</span>}
        </span>
        <input
          ref={input}
          type="file"
          multiple
          accept={imagesOnly ? "image/png,image/jpeg,image/gif,image/webp" : ACCEPT}
          hidden
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && <SelectedFiles files={files} onRemove={(i) => onChange(files.filter((_, j) => j !== i))} />}
    </div>
  );
}

function SelectedFiles({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const u = files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : ""));
    setUrls(u);
    return () => u.forEach((x) => x && URL.revokeObjectURL(x));
  }, [files]);
  return (
    <div className="att-grid sm">
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="att-thumb sm selected">
          <span className="att-media">{urls[i] ? <img src={urls[i]} alt="" /> : f.type.startsWith("video/") ? <Film /> : <FileText />}</span>
          <span className="att-name truncate" title={f.name}>
            {f.name}
          </span>
          <button className="att-remove" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
