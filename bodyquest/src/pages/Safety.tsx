import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/Icon';
import { Card, Note } from '../components/ui';
import { useApp } from '../store/AppStore';
import { STREAK_RULES } from './Streaks';

export default function SafetyPage() {
  const { user, data } = useApp();
  useEffect(() => {
    document.title = 'Privacy & Safety · BODYQUEST';
  }, []);
  return (
    <div className="content" style={{ maxWidth: 960 }}>
      <div className="row-between mb-3">
        <Link to={user && data.plan ? '/app' : '/'} className="brand" style={{ padding: 0, color: 'inherit' }}>
          <BrandMark />
          <span className="brand-name">BODYQUEST</span>
        </Link>
        <Link to={user && data.plan ? '/app' : '/'} className="btn btn-secondary btn-sm">
          {user && data.plan ? 'Back to app' : 'Home'}
        </Link>
      </div>
      <h1>Privacy & Safety</h1>
      <p className="muted">BODYQUEST is a general fitness tool. It is not a medical device and does not replace advice from a doctor, physiotherapist or registered dietitian.</p>

      <Note tone="danger" title="Stop exercising and get help if you experience">
        Chest pain, pressure or tightness · fainting, dizziness or light-headedness · severe breathlessness that doesn’t settle · a racing or irregular heartbeat · sudden sharp pain, numbness or weakness. If symptoms are severe or don’t settle quickly, call your local emergency number (999 in Bangladesh and the UK, 911 in the US/Canada, 112 in the EU).
      </Note>

      <div className="grid-2 mt-3">
        <Card title="Before you start">
          <ul className="bullets">
            <li>Check with a health professional first if you have a heart condition, high blood pressure, diabetes, are pregnant or postpartum, are recovering from surgery or injury, or have any other health concern.</li>
            <li>The onboarding readiness check puts your plan in low-intensity mode when needed.</li>
            <li>Tell us about limitations — unsuitable exercises are removed automatically. The app never diagnoses conditions.</li>
          </ul>
        </Card>
        <Card title="Training safely">
          <ul className="bullets">
            <li>Always warm up and cool down.</li>
            <li>Mild muscle soreness is normal; sharp or joint pain is not — stop that movement and report it.</li>
            <li>Training to failure, punishment workouts and double sessions are never required.</li>
            <li>Rest days are part of the plan. Never train while unwell to protect a streak — mark the day as unwell instead.</li>
            <li>Illustrations show general positions and can’t guarantee correct technique. Move slowly and use a mirror.</li>
          </ul>
        </Card>
        <Card title="Food & hydration">
          <ul className="bullets">
            <li>No extreme calorie deficits, starvation diets, dehydration or unsafe bulking — ever.</li>
            <li>Under-18s and people with medical considerations get general balanced-eating guidance, not calorie targets.</li>
            <li>Nutrition values are approximate sample data and are labelled as such. Unknown values are never invented.</li>
            <li>Supplements are optional.</li>
            <li>Hydration targets are starting estimates. A doctor’s fluid limit always overrides them. Don’t drink large amounts quickly.</li>
          </ul>
        </Card>
        <Card title="Results & body image">
          <ul className="bullets">
            <li>Body-goal illustrations show training emphasis, not guaranteed outcomes.</li>
            <li>We never promise specific muscle gain, fat loss or body shape changes, and never infer health from images.</li>
            <li>Daily weight fluctuates with water and food — look at long-term trends, or turn weight tracking off.</li>
            <li>Battles score consistency only. Body weight, measurements and photos are never compared or shown.</li>
          </ul>
        </Card>
        <Card title="Your privacy in this build">
          <ul className="bullets">
            <li>All data — profile, health answers, logs, measurements and photos — is stored only in this browser (localStorage and IndexedDB).</li>
            <li>Nothing is sent to a server or an AI service. The coach is rule-based and runs on your device.</li>
            <li>Demo accounts hash passwords (PBKDF2) but are not production-grade security; anyone with access to this browser profile could read the data.</li>
            <li>You can export or permanently delete your data in Settings at any time.</li>
            <li>Progress photos are private, blurred by default and never shared.</li>
          </ul>
        </Card>
        <Card title="Streak rules">
          <ul className="bullets">
            {STREAK_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Community & competition" className="mt-3">
        <p className="mb-0">
          Battles in this build use clearly-labelled demo opponents. A future live community must be respectful and free from body-shaming: no appearance-based ranking, under-18s matched only with under-18s, and reporting/blocking tools before launch.
        </p>
      </Card>
    </div>
  );
}
