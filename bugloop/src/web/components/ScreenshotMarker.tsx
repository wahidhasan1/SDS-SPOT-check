// A screenshot with the problem area outlined. When editable, drag on the image to draw a new box.

import { useRef, useState, type PointerEvent } from "react";
import type { Box } from "../../core/types";
import { cx } from "./ui";

export function ScreenshotMarker({
  src,
  alt,
  box,
  onChange,
  label,
}: {
  src: string | null;
  alt: string;
  box: Box | null;
  /** Present when the viewer may redraw the box. */
  onChange?: (box: Box | null) => void;
  label?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; box: Box } | null>(null);

  const point = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!onChange) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = point(e);
    setDrag({ x0: p.x, y0: p.y, box: { x: p.x, y: p.y, w: 0, h: 0 } });
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const p = point(e);
    setDrag({ ...drag, box: { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) } });
  };
  const up = () => {
    if (!drag) return;
    const b = drag.box;
    setDrag(null);
    // A click without a drag keeps the current box.
    if (b.w > 0.01 && b.h > 0.01) onChange?.(b);
  };

  const shown = drag?.box ?? box;
  return (
    <div className="marker-wrap">
      <div
        ref={ref}
        className={cx("marker", onChange && "editable")}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
        role={onChange ? "application" : undefined}
        aria-label={onChange ? "Drag on the screenshot to mark where the problem is" : undefined}
      >
        {src ? <img src={src} alt={alt} draggable={false} /> : <div className="marker-empty">Loading screenshot…</div>}
        {shown && shown.w > 0 && shown.h > 0 && (
          <span
            className="marker-box"
            style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }}
          >
            {label && !drag && <span className="marker-label">{label}</span>}
          </span>
        )}
      </div>
      {onChange && (
        <div className="row-between tiny muted" style={{ marginTop: 4 }}>
          <span>Drag on the screenshot to mark the problem area.</span>
          {box && (
            <button type="button" className="link-btn tiny" onClick={() => onChange(null)}>
              Remove box
            </button>
          )}
        </div>
      )}
    </div>
  );
}
