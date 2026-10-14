import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/features/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile, settings } = await requireUser();
  return (
    <div>
      <PageHeader title="Settings" description="Manage your profile, matching, notifications, privacy, and accessibility. Each section saves separately." />
      <SettingsForm profile={profile} settings={settings} />
    </div>
  );
}
