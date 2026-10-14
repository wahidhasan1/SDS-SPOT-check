"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function SaveSentenceButton({
  original,
  corrected,
  explanation,
  category,
  sourceKind,
  sourceId,
  initiallySaved = false,
  size = "sm",
  label = "Save",
}: {
  original: string;
  corrected: string;
  explanation?: string | null;
  category?: string | null;
  sourceKind: "transcript" | "coach" | "battle";
  sourceId?: string | null;
  initiallySaved?: boolean;
  size?: "sm" | "md";
  label?: string;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(initiallySaved);
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant={saved ? "secondary" : "outline"}
      size={size}
      loading={loading}
      disabled={saved}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await api<{ alreadySaved: boolean; newAchievements: { name: string }[] }>("/api/saved-sentences", {
            body: { original, corrected, explanation: explanation ?? null, category: category ?? null, sourceKind, sourceId: sourceId ?? null },
          });
          setSaved(true);
          toast({
            tone: "success",
            title: res.alreadySaved ? "Already in My Learning" : "Saved to My Learning",
            description: res.newAchievements.length ? `Achievement unlocked: ${res.newAchievements.map((a) => a.name).join(", ")}` : undefined,
          });
        } catch (e) {
          toast({ tone: "error", title: "Could not save", description: errorMessage(e) });
        } finally {
          setLoading(false);
        }
      }}
    >
      {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {saved ? "Saved" : label}
    </Button>
  );
}
