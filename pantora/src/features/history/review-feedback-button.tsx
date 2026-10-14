"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export function ReviewFeedbackButton({ feedbackId, reviewed }: { feedbackId: string; reviewed: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  if (reviewed)
    return (
      <Badge tone="success">
        <CheckCheck className="h-3.5 w-3.5" /> Feedback reviewed
      </Badge>
    );
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await api<{ xp: number; newAchievements: { name: string }[] }>(`/api/feedback/${feedbackId}/review`, { body: {} });
          toast({ tone: "success", title: "Feedback marked as reviewed", description: [res.xp ? `+${res.xp} XP` : null, ...res.newAchievements.map((a) => `Achievement unlocked: ${a.name}`)].filter(Boolean).join(" · ") || undefined });
          router.refresh();
        } catch (e) {
          toast({ tone: "error", title: "Could not update", description: errorMessage(e) });
        } finally {
          setLoading(false);
        }
      }}
    >
      <CheckCheck className="h-4 w-4" /> Mark feedback as reviewed
    </Button>
  );
}
