import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { config } from "@/server/config";
import { favoriteTopicIds, listTopics } from "@/server/queries";
import { FreeTalkExperience } from "@/features/free-talk/free-talk-experience";

export const metadata: Metadata = { title: "Free Talk" };

export default async function FreeTalkPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { profile, settings } = await requireUser();
  const { topic } = await searchParams;
  const topics = listTopics();
  return (
    <FreeTalkExperience
      profile={{ id: profile.id, displayName: profile.displayName, avatar: profile.avatar, proficiency: profile.proficiency }}
      matching={settings.matching}
      retention={settings.privacy.transcriptRetention}
      topics={topics}
      favoriteIds={favoriteTopicIds(profile.id)}
      initialTopicId={topics.some((t) => t.id === topic) ? topic! : null}
      liveEnabled={config.live.enabled}
    />
  );
}
