"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ReportStatusControl({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Select value={value} onChange={(e) => setValue(e.target.value)} aria-label="Report status" className="h-9 w-36 text-sm">
        <option value="open">Open</option>
        <option value="reviewing">Reviewing</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </Select>
      <Button
        size="sm"
        disabled={value === status}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await api(`/api/admin/reports/${id}`, { method: "PATCH", body: { status: value } });
            toast({ tone: "success", title: "Report updated" });
            router.refresh();
          } catch (e) {
            toast({ tone: "error", title: "Could not update report", description: errorMessage(e) });
          } finally {
            setLoading(false);
          }
        }}
      >
        Update
      </Button>
    </div>
  );
}
