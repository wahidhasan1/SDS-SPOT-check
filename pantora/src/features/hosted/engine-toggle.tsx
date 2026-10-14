"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

// Hosted preview only: lets the viewer choose whether feedback comes from
// Claude (through the page's Claude access) or from the rule-based demo analyzer.

export type Engine = "claude" | "rules";
const KEY = "pantora-ai-engine";

declare global {
  interface Window {
    __PANTORA_SAMPLE_READY__?: boolean;
    __PANTORA_ENGINE__?: Engine;
  }
}

export function readEngine(): Engine {
  if (typeof window === "undefined") return "rules";
  if (window.__PANTORA_ENGINE__) return window.__PANTORA_ENGINE__;
  try {
    const v = localStorage.getItem(KEY);
    if (v === "claude" || v === "rules") return v;
  } catch {
    /* storage unavailable */
  }
  return "claude";
}

export function EngineToggle({ compact }: { compact?: boolean }) {
  const [engine, setEngine] = useState<Engine>("claude");
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read browser-only state after mount
    setEngine(readEngine());
    const sync = () => setAvailable(window.__PANTORA_SAMPLE_READY__ ?? null);
    sync();
    window.addEventListener("pantora:sample", sync);
    return () => window.removeEventListener("pantora:sample", sync);
  }, []);

  if (available === false) return <Badge tone="demo">Demo analyzer</Badge>;

  return (
    <div className={compact ? "" : "flex flex-col items-end gap-1"}>
      <Segmented
        label="Feedback engine"
        value={engine}
        onChange={(v) => {
          setEngine(v);
          window.__PANTORA_ENGINE__ = v;
          try {
            localStorage.setItem(KEY, v);
          } catch {
            /* storage unavailable */
          }
        }}
        options={[
          { value: "claude", label: available === null ? "Claude…" : "Claude" },
          { value: "rules", label: "Demo rules" },
        ]}
      />
    </div>
  );
}

export function EngineHint() {
  return (
    <p className="text-xs text-muted">
      Claude feedback uses your own Claude account and asks for permission the first time. Demo rules are instant, transparent pattern checks.
    </p>
  );
}
