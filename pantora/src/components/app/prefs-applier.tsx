"use client";

import { useEffect } from "react";

/** Applies the user's accessibility preferences to the document root. */
export function PrefsApplier({ reducedMotion, largerText }: { reducedMotion: boolean; largerText: boolean }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.reducedMotion = String(reducedMotion);
    root.dataset.largerText = String(largerText);
    return () => {
      delete root.dataset.reducedMotion;
      delete root.dataset.largerText;
    };
  }, [reducedMotion, largerText]);
  return null;
}
