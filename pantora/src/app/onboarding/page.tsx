import type { Metadata } from "next";
import { getCurrentUser } from "@/server/auth";
import { config } from "@/server/config";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Get started" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  return <OnboardingFlow signedInAs={user?.displayName ?? null} demoMode={config.demoMode} />;
}
