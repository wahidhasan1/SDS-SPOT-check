import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark, Icon } from '../components/Icon';
import { ExerciseFrames } from '../components/visuals';
import { getExercise } from '../data/exercises';
import { useApp } from '../store/AppStore';

const FEATURES = [
  { icon: 'dumbbell', title: 'Personalised home plans', text: 'A rules-based engine builds sessions from your goal, schedule, time and limitations — no gym or equipment needed.' },
  { icon: 'book', title: 'Visual exercise manuals', text: 'Every exercise has step-by-step illustrations, breathing cues, common mistakes and easier or harder options.' },
  { icon: 'food', title: 'Affordable food planning', text: 'Everyday foods like rice, dal, eggs, fish and roti — with transparent, approximate nutrition.' },
  { icon: 'flame', title: 'Streaks that respect rest', text: 'Rest days never break a streak. Missed a session? Choose a comeback option — no punishment workouts.' },
  { icon: 'swords', title: 'Fair fitness battles', text: 'Compete on consistency with people pursuing similar goals. Capped scoring means no one wins by overtraining.' },
  { icon: 'shield', title: 'Safety first', text: 'Readiness screening, pain reporting and conservative defaults. Your health data stays private.' },
];

export default function Landing() {
  const { user, data, auth } = useApp();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'BODYQUEST — Build Your Body. Beat Your Limits.';
  }, []);
  const primary = user ? (data.plan ? '/app' : '/onboarding') : '/signup';
  return (
    <div className="landing">
      <div className="landing-hero">
        <nav className="landing-nav" aria-label="Site">
          <Link to="/" className="brand">
            <BrandMark />
            <span className="brand-name">BODYQUEST</span>
          </Link>
          <div className="landing-links">
            <Link to="/safety" className="btn btn-ghost btn-sm" style={{ color: 'var(--ink-text)' }}>
              Safety
            </Link>
            {user ? (
              <button className="btn btn-primary btn-sm" onClick={() => navigate(primary)}>
                Open app
              </button>
            ) : (
              <Link to="/signin" className="btn btn-secondary btn-sm" style={{ background: 'transparent', color: 'var(--ink-text)', borderColor: '#2c374b' }}>
                Sign in
              </Link>
            )}
          </div>
        </nav>
        <header className="landing-hero-inner">
          <div>
            <span className="badge badge-accent" style={{ marginBottom: 16 }}>
              Home fitness · No gym required
            </span>
            <h1>
              Build Your Body.
              <br />
              <em>Beat Your Limits.</em>
            </h1>
            <p className="lead">
              You don’t need an expensive gym to start improving your fitness. You need the right plan, consistency, recovery and practical guidance. BODYQUEST gives you all four — and makes it a game.
            </p>
            <div className="row mt-3">
              <Link to={primary} className="btn btn-primary btn-lg">
                {user ? 'Continue your quest' : 'Start your quest — free'} <Icon name="chevronRight" />
              </Link>
              {!user?.isDemo && (
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  style={{ background: 'transparent', color: 'var(--ink-text)', borderColor: '#2c374b' }}
                  disabled={loadingDemo}
                  onClick={async () => {
                    setLoadingDemo(true);
                    await auth.demo();
                    navigate('/app');
                  }}
                >
                  <Icon name="play" /> {loadingDemo ? 'Building demo…' : 'Try the live demo'}
                </button>
              )}
            </div>
            <p className="small mt-3" style={{ color: 'var(--ink-muted)' }}>
              The live demo opens an account with ~3 weeks of sample history. Everything is stored in this browser only.
            </p>
          </div>
          <div className="hero-figures" aria-label="Example exercise illustrations">
            <div className="frame">
              <ExerciseFrames exercise={getExercise('pushup')} compact />
              <div className="frame-caption" style={{ color: 'var(--ink-muted)' }}>Push-Up</div>
            </div>
            <div className="frame">
              <ExerciseFrames exercise={getExercise('bodyweight-squat')} compact />
              <div className="frame-caption" style={{ color: 'var(--ink-muted)' }}>Bodyweight Squat</div>
            </div>
            <div className="frame">
              <ExerciseFrames exercise={getExercise('glute-bridge')} compact />
              <div className="frame-caption" style={{ color: 'var(--ink-muted)' }}>Glute Bridge</div>
            </div>
            <div className="frame">
              <ExerciseFrames exercise={getExercise('bird-dog')} compact />
              <div className="frame-caption" style={{ color: 'var(--ink-muted)' }}>Bird Dog</div>
            </div>
          </div>
        </header>
      </div>

      <section className="landing-section" id="how" aria-labelledby="features-h">
        <h2 id="features-h" style={{ fontSize: '1.8rem' }}>
          Everything you need to train at home
        </h2>
        <p className="muted mb-3">Built for beginners and experienced trainees alike, adapting to your ability and your life.</p>
        <div className="grid-3">
          {FEATURES.map((f) => (
            <div className="card" key={f.title}>
              <div className="feature-icon">
                <Icon name={f.icon} size={22} />
              </div>
              <h3>{f.title}</h3>
              <p className="muted mb-0">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" aria-labelledby="steps-h" style={{ paddingTop: 0 }}>
        <div className="card hero">
          <h2 id="steps-h">Your quest in four steps</h2>
          <div className="grid-4 mt-2">
            {[
              ['1', 'Tell us about you', 'Body profile, schedule, limitations and food preferences.'],
              ['2', 'Pick your goal', 'Choose a physique goal, training pattern and timeline.'],
              ['3', 'Train & track', 'Guided workouts, food, water and streaks every day.'],
              ['4', 'Level up', 'Earn XP, unlock achievements and win fair battles.'],
            ].map(([n, t, d]) => (
              <div key={n}>
                <div className="timer-big" style={{ color: 'var(--accent)' }}>{n}</div>
                <h3 className="mt-1">{t}</h3>
                <p className="muted mb-0">{d}</p>
              </div>
            ))}
          </div>
          <Link to={primary} className="btn btn-primary btn-lg mt-3">
            Start Today’s Journey
          </Link>
        </div>
      </section>

      <footer className="footer">
        <div className="row-between">
          <span>© BODYQUEST · General fitness guidance, not medical advice.</span>
          <Link to="/safety">Privacy & Safety</Link>
        </div>
      </footer>
    </div>
  );
}
