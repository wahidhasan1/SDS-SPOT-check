"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlockDialog, ReportDialog, type SafetyTarget } from "@/features/safety/safety-dialogs";

export function PartnerActions({ target, blocked }: { target: SafetyTarget; blocked: boolean }) {
  const router = useRouter();
  const [report, setReport] = useState(false);
  const [block, setBlock] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setReport(true)}>
        <Flag className="h-4 w-4" /> Report
      </Button>
      {blocked ? (
        <Badge tone="danger">Blocked</Badge>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setBlock(true)}>
          <Ban className="h-4 w-4" /> Block
        </Button>
      )}
      <ReportDialog open={report} onClose={() => setReport(false)} target={target} onReported={() => router.refresh()} />
      <BlockDialog open={block} onClose={() => setBlock(false)} target={target} onBlocked={() => router.refresh()} />
    </div>
  );
}
