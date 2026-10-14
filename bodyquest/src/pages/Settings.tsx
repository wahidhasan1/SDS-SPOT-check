import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHead } from '../components/Layout';
import { Badge, Button, Card, Field, Modal, Note, Segmented, Toggle } from '../components/ui';
import { formatDate } from '../services/dates';
import { needsMedicalClearance } from '../services/safety';
import { updateProfile, updateSettings } from '../store/actions';
import { useApp } from '../store/AppStore';

/** Hosted single-file demo (memory router) runs in a sandbox that blocks file downloads. */
const EMBEDDED = import.meta.env.VITE_ROUTER === 'memory';

export default function SettingsPage() {
  const { data, user, today, run, auth } = useApp();
  const navigate = useNavigate();
  const s = data.settings;
  const p = data.profile!;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const set = (patch: Partial<typeof s>) => run(updateSettings, patch);

  const exportData = () => {
    const { photos: _p, ...rest } = data;
    void _p;
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), user: { email: user?.email, displayName: user?.displayName }, ...rest }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bodyquest-export-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead title="Settings" />
      <div className="grid-2">
        <Card title="Appearance & accessibility">
          <div className="toggle">
            <span style={{ fontWeight: 700 }}>Theme</span>
            <Segmented
              label="Theme"
              value={s.theme}
              onChange={(v) => set({ theme: v })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </div>
          <Toggle label="Reduce motion" description="Turns off animations and celebration effects." checked={s.reducedMotion} onChange={(v) => set({ reducedMotion: v })} />
        </Card>

        <Card title="Privacy">
          <Toggle label="Track body weight" description="Turn off to focus on performance and consistency instead. Weight fields are hidden everywhere." checked={s.trackBodyWeight} onChange={(v) => set({ trackBodyWeight: v })} />
          <Toggle label="Hide body measurements" description="Masks weight and measurements on screen (e.g. when others can see your phone)." checked={s.hideMeasurements} onChange={(v) => set({ hideMeasurements: v })} />
          <Toggle label="Show me on leaderboards" description="Only your display name, avatar and consistency points are ever shown. Never measurements or photos." checked={s.showOnLeaderboard} onChange={(v) => set({ showOnLeaderboard: v })} />
          <Toggle label="Allow battle invitations" checked={s.allowBattleInvites} onChange={(v) => set({ allowBattleInvites: v })} />
          <Toggle label="Coach may use my profile & plan" description="The demo coach runs entirely on this device. Nothing is sent to an external AI service." checked={s.coachUsesProfile} onChange={(v) => set({ coachUsesProfile: v })} />
        </Card>

        <Card title="Health & safety">
          <p className="small muted">Your readiness answers control whether the plan stays in low-intensity mode.</p>
          {needsMedicalClearance(p.readiness) ? (
            <>
              <Note tone="warning" title="Low-intensity mode is on">
                Only switch this off after a doctor or qualified health professional has confirmed it’s safe for you to exercise more intensely.
              </Note>
              <Button
                className="mt-2"
                variant="secondary"
                onClick={() =>
                  run(updateProfile, { readiness: { heartConditionOrSupervised: false, chestPainOnActivity: false, dizzinessOrFainting: false, otherMedicalReason: false } })
                }
              >
                A health professional has cleared me
              </Button>
            </>
          ) : (
            <Note tone="success">No readiness flags. If your health changes, update your answers in your body profile.</Note>
          )}
          <div className="row mt-2">
            <Link to="/onboarding/profile" className="btn btn-ghost btn-sm">
              Update readiness & limitations
            </Link>
            <Link to="/safety" className="btn btn-ghost btn-sm">
              Safety information
            </Link>
          </div>
        </Card>

        <Card title="Your data">
          <p className="small">
            Signed in as <strong>{user?.isGuest ? 'Guest' : user?.email}</strong> <Badge tone="warning">Local demo account</Badge>
          </p>
          <p className="small muted">All data is stored in this browser only. Export it as JSON, or delete everything permanently.</p>
          <div className="row">
            {EMBEDDED ? (
              <span className="small muted">Data export isn’t available in the hosted demo. Run the app locally to export.</span>
            ) : (
              <Button variant="secondary" icon="download" onClick={exportData}>
                Export my data
              </Button>
            )}
            <Button
              variant="secondary"
              icon="logout"
              onClick={() => {
                auth.signOut();
                navigate('/');
              }}
            >
              Sign out
            </Button>
            <Button variant="danger-outline" icon="trash" onClick={() => setConfirmDelete(true)}>
              Delete account & data
            </Button>
          </div>
        </Card>

        <Card title="Developer tools (demo only)" className="span-2">
          <p className="small muted">
            Simulate the passage of time to try streaks, missed-session recovery and battle results without waiting. This shifts the app’s clock only on this device. App date: <strong>{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong>
            {s.devDayOffset > 0 && <> (+{s.devDayOffset} day{s.devDayOffset > 1 ? 's' : ''})</>}
          </p>
          <div className="row">
            <Button variant="secondary" onClick={() => set({ devDayOffset: s.devDayOffset + 1 })}>
              Advance 1 day
            </Button>
            <Button variant="secondary" onClick={() => set({ devDayOffset: s.devDayOffset + 7 })}>
              Advance 7 days
            </Button>
            <Button variant="ghost" disabled={s.devDayOffset === 0} onClick={() => set({ devDayOffset: 0 })}>
              Reset to real date
            </Button>
          </div>
        </Card>
      </div>

      {confirmDelete && (
        <Modal
          title="Delete account and all data?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={typed !== 'DELETE'}
                onClick={() => {
                  auth.deleteAccount();
                  navigate('/');
                }}
              >
                Delete permanently
              </Button>
            </>
          }
        >
          <p>This permanently removes your profile, plan, workouts, food and water logs, progress entries, photos, battles and XP from this device. It can’t be undone.</p>
          <Field label="Type DELETE to confirm">{(f) => <input {...f} className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}</Field>
        </Modal>
      )}
    </>
  );
}
