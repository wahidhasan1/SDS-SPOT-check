import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { favoriteTopicIds, listTopics, practicedTopicCounts } from "@/server/queries";
import { BATTLE_PROMPTS } from "@/content/battle-prompts";
import { PageHeader } from "@/components/app/page-header";
import { TopicsLibrary } from "@/features/topics/topics-library";
import { TopicsArt } from "@/components/art/scene-art";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage() {
  const { profile } = await requireUser();
  const battleByTopic = Object.fromEntries(BATTLE_PROMPTS.filter((p) => p.topicId).map((p) => [p.topicId!, p.id]));
  return (
    <div>
      <PageHeader title="Topics library" description="Conversation ideas with opening and follow-up questions. Start a Free Talk, a speaking challenge, or a coach exercise from any topic." tone="sun" art={<TopicsArt />} />
      <TopicsLibrary topics={listTopics()} favoriteIds={favoriteTopicIds(profile.id)} practiced={practicedTopicCounts(profile.id)} battleByTopic={battleByTopic} />
    </div>
  );
}
