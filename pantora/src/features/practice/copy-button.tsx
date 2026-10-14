"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setFailed(false);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setFailed(true);
        }
      }}
      aria-label={`${label}: ${text}`}
    >
      {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : failed ? "Copy blocked" : label}
    </Button>
  );
}
