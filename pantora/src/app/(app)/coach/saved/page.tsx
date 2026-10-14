import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listSavedSentences } from "@/server/queries";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { SavedSentencesList } from "@/features/coach/saved-sentences-list";

export const metadata: Metadata = { title: "My Learning" };

export default async function SavedPage() {
  const { profile } = await requireUser();
  const items = listSavedSentences(profile.id);
  return (
    <div>
      <PageHeader
        title="My Learning"
        description="Better sentences you've saved from conversations, battles, and coach feedback. Review them out loud to make them your own."
        actions={<ButtonLink href="/coach" variant="outline">Back to coach</ButtonLink>}
      />
      <SavedSentencesList items={items} timeZone={profile.timezone} />
    </div>
  );
}
