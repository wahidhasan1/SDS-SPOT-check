import { requireUser } from "@/server/auth";
import { config } from "@/server/config";
import { ensureDailyReminders, getHeaderData, purgeExpiredTranscripts } from "@/server/queries";
import { Sidebar } from "@/components/app/sidebar";
import { MobileTabBar, TopBar } from "@/components/app/top-bar";
import { PrefsApplier } from "@/components/app/prefs-applier";
import { ToastProvider } from "@/components/ui/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, settings } = await requireUser();
  purgeExpiredTranscripts();
  ensureDailyReminders(profile, settings);
  const header = getHeaderData(profile);
  const player = { displayName: profile.displayName, avatar: profile.avatar, streak: header.streak, practicedToday: header.practicedToday, ...header.player };

  return (
    <ToastProvider>
      <PrefsApplier reducedMotion={settings.accessibility.reducedMotion} largerText={settings.accessibility.largerText} />
      <a href="#main" className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <Sidebar isDemoAccount={profile.isDemoAccount} demoMode={config.demoMode} player={player} />
      <div className="lg:pl-68">
        <TopBar
          user={{ displayName: profile.displayName, avatar: profile.avatar, isDemoAccount: profile.isDemoAccount }}
          player={player}
          notifications={header.notifications}
          demoMode={config.demoMode}
        />
        <main id="main" className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-12">
          {children}
        </main>
      </div>
      <MobileTabBar />
    </ToastProvider>
  );
}
