"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Accessibility, Bell, Lock, LogOut, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import type { UserProfile, UserSettings } from "@/lib/types";
import { CONVERSATION_PREFS, DAILY_GOALS, LEARNING_GOALS, PROFICIENCY_LEVELS, TOPIC_CATEGORIES } from "@/lib/types";
import { CATEGORY_LABELS, CONVERSATION_PREF_LABELS, GOAL_LABELS, PROFICIENCY_LABELS } from "@/lib/labels";
import { AvatarPicker } from "@/components/app/avatar-picker";
import { displayNameSchema } from "@/lib/schemas";
import { api, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldHint, Input, Label, Segmented, Select, Switch } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type SectionKey = "profile" | "matching" | "notifications" | "privacy" | "accessibility";

export function SettingsForm({ profile, settings, levelIndex }: { profile: UserProfile; settings: UserSettings; levelIndex: number }) {
  const router = useRouter();
  const toast = useToast();
  const initialProfile = {
    displayName: profile.displayName,
    avatar: profile.avatar,
    proficiency: profile.proficiency,
    goals: profile.goals,
    dailyGoalMinutes: profile.dailyGoalMinutes,
    conversationPref: profile.conversationPref,
  };
  const [saved, setSaved] = useState({ profile: initialProfile, ...settings });
  const [p, setP] = useState(initialProfile);
  const [matching, setMatching] = useState(settings.matching);
  const [notifications, setNotifications] = useState(settings.notifications);
  const [privacy, setPrivacy] = useState(settings.privacy);
  const [accessibility, setAccessibility] = useState(settings.accessibility);
  const [saving, setSaving] = useState<SectionKey | null>(null);
  const [savedAt, setSavedAt] = useState<Partial<Record<SectionKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<SectionKey, string>>>({});

  const nameCheck = useMemo(() => displayNameSchema.safeParse(p.displayName), [p.displayName]);
  const current = { profile: p, matching, notifications, privacy, accessibility };
  const dirty = (k: SectionKey) => JSON.stringify(current[k]) !== JSON.stringify(saved[k]);

  async function save(k: SectionKey) {
    if (k === "profile" && (!nameCheck.success || p.goals.length === 0)) {
      setErrors((e) => ({ ...e, profile: !nameCheck.success ? nameCheck.error.issues[0]?.message : "Choose at least one goal." }));
      return;
    }
    if (k === "matching" && PROFICIENCY_LEVELS.indexOf(matching.proficiencyRange[0]) > PROFICIENCY_LEVELS.indexOf(matching.proficiencyRange[1])) {
      setErrors((e) => ({ ...e, matching: "The lowest level must not be above the highest level." }));
      return;
    }
    setSaving(k);
    setErrors((e) => ({ ...e, [k]: undefined }));
    try {
      const res = await api<{ savedAt: string }>("/api/settings", { method: "PATCH", body: { [k]: current[k] } });
      setSaved((s) => ({ ...s, [k]: current[k] }));
      setSavedAt((s) => ({ ...s, [k]: new Date(res.savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }));
      toast({ tone: "success", title: "Settings saved" });
      router.refresh();
    } catch (e) {
      setErrors((x) => ({ ...x, [k]: errorMessage(e) }));
      toast({ tone: "error", title: "Settings were not saved", description: errorMessage(e) });
    } finally {
      setSaving(null);
    }
  }

  const footer = (k: SectionKey) => (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
      {errors[k] && (
        <p role="alert" className="mr-auto text-sm font-medium text-danger-600">
          {errors[k]}
        </p>
      )}
      {!errors[k] && savedAt[k] && !dirty(k) && <p className="mr-auto text-sm text-success-700">Saved at {savedAt[k]}</p>}
      {!errors[k] && dirty(k) && <p className="mr-auto text-sm text-streak-700">Unsaved changes</p>}
      <Button onClick={() => save(k)} loading={saving === k} disabled={!dirty(k)}>
        Save changes
      </Button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="sticky top-24 space-y-1 text-sm font-semibold">
          {[
            ["profile", "Profile"],
            ["matching", "Matching"],
            ["notifications", "Notifications"],
            ["privacy", "Privacy"],
            ["accessibility", "Accessibility"],
            ["account", "Account"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-xl px-3 py-2 text-ink-soft hover:bg-surface hover:text-ink">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        <Section id="profile" title="Profile" description="How you appear to partners and what you're working on." icon={<UserRound className="h-5 w-5" />}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-name">Display name</Label>
              <Input id="s-name" value={p.displayName} maxLength={24} onChange={(e) => setP({ ...p, displayName: e.target.value })} aria-invalid={!nameCheck.success} />
              {!nameCheck.success ? <FieldHint error>{nameCheck.error.issues[0]?.message}</FieldHint> : <FieldHint>Shown to partners. Don&apos;t use your full real name.</FieldHint>}
            </div>
            <div>
              <Label htmlFor="s-level">Estimated proficiency</Label>
              <Select id="s-level" value={p.proficiency} onChange={(e) => setP({ ...p, proficiency: e.target.value as UserProfile["proficiency"] })}>
                {PROFICIENCY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {PROFICIENCY_LABELS[l]}
                  </option>
                ))}
              </Select>
              <FieldHint>An estimate for matching — update it whenever it feels wrong.</FieldHint>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Avatar</p>
            <AvatarPicker value={p.avatar} onChange={(avatar) => setP({ ...p, avatar })} name={p.displayName} levelIndex={levelIndex} size="sm" />
            <FieldHint>Reward avatars unlock as you level up.</FieldHint>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Learning goals</p>
            <div className="flex flex-wrap gap-2">
              {LEARNING_GOALS.map((g) => {
                const on = p.goals.includes(g);
                return (
                  <Chip key={g} on={on} onClick={() => setP({ ...p, goals: on ? p.goals.filter((x) => x !== g) : [...p.goals, g] })}>
                    {GOAL_LABELS[g]}
                  </Chip>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label>Daily practice target</Label>
              <Segmented label="Daily practice target" value={p.dailyGoalMinutes} onChange={(v) => setP({ ...p, dailyGoalMinutes: v })} options={DAILY_GOALS.map((g) => ({ value: g, label: `${g} min` }))} />
            </div>
            <div>
              <Label>Preferred practice</Label>
              <Segmented label="Preferred practice" value={p.conversationPref} onChange={(v) => setP({ ...p, conversationPref: v })} options={CONVERSATION_PREFS.map((c) => ({ value: c, label: CONVERSATION_PREF_LABELS[c] }))} />
            </div>
          </div>
          {footer("profile")}
        </Section>

        <Section id="matching" title="Matching preferences" description="Used when finding Free Talk partners and battle opponents." icon={<SlidersHorizontal className="h-5 w-5" />}>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="m-low">Partner level from</Label>
              <Select id="m-low" value={matching.proficiencyRange[0]} onChange={(e) => setMatching({ ...matching, proficiencyRange: [e.target.value as UserProfile["proficiency"], matching.proficiencyRange[1]] })}>
                {PROFICIENCY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {PROFICIENCY_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="m-high">to</Label>
              <Select id="m-high" value={matching.proficiencyRange[1]} onChange={(e) => setMatching({ ...matching, proficiencyRange: [matching.proficiencyRange[0], e.target.value as UserProfile["proficiency"]] })}>
                {PROFICIENCY_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {PROFICIENCY_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Preferred topic categories</p>
            <div className="flex flex-wrap gap-2">
              {TOPIC_CATEGORIES.map((c) => {
                const on = matching.topicCategories.includes(c);
                return (
                  <Chip key={c} on={on} onClick={() => setMatching({ ...matching, topicCategories: on ? matching.topicCategories.filter((x) => x !== c) : [...matching.topicCategories, c] })}>
                    {CATEGORY_LABELS[c]}
                  </Chip>
                );
              })}
            </div>
            <FieldHint>Leave all unselected to get suggestions from every category.</FieldHint>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label>Default session length</Label>
              <Segmented label="Default session length" value={matching.durationMinutes} onChange={(v) => setMatching({ ...matching, durationMinutes: v })} options={[5, 10, 15].map((v) => ({ value: v as 5 | 10 | 15, label: `${v} min` }))} />
            </div>
            <div>
              <Label>Practice mode preference</Label>
              <Segmented label="Practice mode preference" value={matching.modePreference} onChange={(v) => setMatching({ ...matching, modePreference: v })} options={CONVERSATION_PREFS.map((c) => ({ value: c, label: CONVERSATION_PREF_LABELS[c] }))} />
            </div>
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line px-4">
            <Switch checked={matching.globalMatching} onChange={(v) => setMatching({ ...matching, globalMatching: v })} label="Global matching" description="Match with learners in any time zone. Pantora never matches by nationality." />
            <Switch checked={matching.englishOnly} onChange={(v) => setMatching({ ...matching, englishOnly: v })} label="English-only conversations" description="Both partners agree to speak only English." />
            <Switch checked={matching.suggestTopic} onChange={(v) => setMatching({ ...matching, suggestTopic: v })} label="Suggest a topic by default" description="Start Free Talks with a topic card from your preferred categories." />
          </div>
          {footer("matching")}
        </Section>

        <Section id="notifications" title="Notifications" description="Pantora shows these inside the app. Email or push delivery would need a notification service, which isn't configured." icon={<Bell className="h-5 w-5" />}>
          <div className="divide-y divide-line rounded-2xl border border-line px-4">
            <Switch checked={notifications.practiceReminders} onChange={(v) => setNotifications({ ...notifications, practiceReminders: v })} label="Practice reminders" description="A gentle in-app reminder in the evening if you haven't practiced." />
            <Switch checked={notifications.streakReminders} onChange={(v) => setNotifications({ ...notifications, streakReminders: v })} label="Streak reminders" description="A reminder when your streak needs today's practice." />
            <Switch checked={notifications.achievementNotifications} onChange={(v) => setNotifications({ ...notifications, achievementNotifications: v })} label="Achievement notifications" description="Celebrate new badges, levels, goals, and streak milestones." />
          </div>
          {footer("notifications")}
        </Section>

        <Section id="privacy" title="Privacy" description="Control what others see and what Pantora keeps." icon={<Lock className="h-5 w-5" />}>
          <div className="divide-y divide-line rounded-2xl border border-line px-4">
            <Switch checked={privacy.showDisplayName} onChange={(v) => setPrivacy({ ...privacy, showDisplayName: v })} label="Show my display name to partners" description='When off, live partners see "Pantora learner" instead.' />
            <Switch checked={privacy.showPartnerNamesInHistory} onChange={(v) => setPrivacy({ ...privacy, showPartnerNamesInHistory: v })} label="Show partner names in my history" description="Turn off to hide partner names in your session history." />
          </div>
          <div>
            <Label htmlFor="retention">Transcript retention</Label>
            <Select id="retention" value={privacy.transcriptRetention} onChange={(e) => setPrivacy({ ...privacy, transcriptRetention: e.target.value as typeof privacy.transcriptRetention })}>
              <option value="keep">Keep transcripts until I delete my account</option>
              <option value="30d">Delete transcripts after 30 days</option>
              <option value="none">Don&apos;t keep transcripts (feedback only)</option>
            </Select>
            <FieldHint>Applies to new sessions. Existing transcripts keep the setting they were saved with.</FieldHint>
          </div>
          <div className="rounded-2xl bg-surface-muted/60 p-4 text-sm text-ink-soft">
            <p className="font-semibold text-ink">Recordings and audio processing</p>
            <ul className="mt-2 space-y-1.5">
              <li>• Free Talk calls are never recorded.</li>
              <li>• Battle and coach recordings stay in your browser for playback and are discarded when you leave the page.</li>
              <li>• Live captions use your browser&apos;s speech recognition; in Chrome, audio is processed by Google&apos;s speech service.</li>
              <li>• A recording is uploaded only if you press “Send recording for transcription” (when a speech-to-text service is configured).</li>
            </ul>
            <Link href="/privacy" className="mt-2 inline-block font-semibold text-brand-600">
              Read the privacy overview →
            </Link>
          </div>
          {footer("privacy")}
        </Section>

        <Section id="accessibility" title="Accessibility" description="Pantora also follows your device's reduced-motion setting automatically." icon={<Accessibility className="h-5 w-5" />}>
          <div className="divide-y divide-line rounded-2xl border border-line px-4">
            <Switch checked={accessibility.reducedMotion} onChange={(v) => setAccessibility({ ...accessibility, reducedMotion: v })} label="Reduce motion" description="Turns off animations such as pulsing search rings and floating cards." />
            <Switch checked={accessibility.largerText} onChange={(v) => setAccessibility({ ...accessibility, largerText: v })} label="Larger text" description="Increases text size across the app by about 12%." />
          </div>
          {footer("accessibility")}
        </Section>

        <AccountSection profile={profile} />
      </div>
    </div>
  );
}

function Section({ id, title, description, icon, children }: { id: string; title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={title} description={description} icon={icon} />
      <CardBody className="space-y-5">{children}</CardBody>
    </Card>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors", on ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line text-ink-soft hover:bg-surface-muted")}
    >
      {children}
    </button>
  );
}

function AccountSection({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Card id="account" className="scroll-mt-24">
      <CardHeader title="Account" description="Sign-in status and data controls." icon={<UserRound className="h-5 w-5" />} />
      <CardBody className="space-y-5">
        <div className="rounded-2xl bg-surface-muted/60 p-4 text-sm">
          <p className="font-semibold">Signed in as {profile.displayName}</p>
          <p className="mt-1 text-muted">
            {profile.isDemoAccount ? "Shared demo account with sample history." : "Local demo profile."} This demo identifies you with a browser cookie on this device — there is no password or email
            account. Connecting a real sign-in provider is described in the README.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            loading={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await api("/api/auth/signout", { body: {} });
                router.push("/");
                router.refresh();
              } catch (e) {
                setSigningOut(false);
                toast({ tone: "error", title: "Sign out failed", description: errorMessage(e) });
              }
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          <Button variant="outline" className="border-danger-100 text-danger-700 hover:bg-danger-50" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" /> Delete account and data
          </Button>
        </div>
      </CardBody>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title="Delete your account?"
        description="This permanently deletes your profile, sessions, transcripts, feedback, saved sentences, XP, and achievements from this Pantora server. It can't be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={loading}
              disabled={confirm.trim() !== profile.displayName}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  await api("/api/account", { method: "DELETE", body: { confirm } });
                  router.push("/");
                  router.refresh();
                } catch (e) {
                  setError(errorMessage(e));
                  setLoading(false);
                }
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        {profile.isDemoAccount && <p className="mb-3 rounded-xl bg-streak-50 px-3.5 py-2.5 text-sm text-streak-700">This is the shared demo account. An admin can restore it with “Reset demo data”.</p>}
        <Label htmlFor="confirm-delete">
          Type <span className="font-mono">{profile.displayName}</span> to confirm
        </Label>
        <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        {error && <p className="mt-2 text-sm font-medium text-danger-600">{error}</p>}
      </Dialog>
    </Card>
  );
}
