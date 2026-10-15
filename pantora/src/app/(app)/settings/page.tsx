import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { getDb } from "@/server/db";
import { totalXp } from "@/server/services/gamification";
import { levelForXp } from "@/lib/game-rules";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/features/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, settings } = await requireUser();
  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, matching, notifications, privacy, and accessibility. Each section saves separately." />
      <SettingsForm profile={profile} settings={settings} levelIndex={levelForXp(totalXp(getDb(), profile.id)).current.index} />
    </div>
  );
}
