import { Link } from 'react-router-dom';
import { APP_NAME } from '../lib/api';

const FEATURES = [
  ['🎧', 'Real speaking partners', 'Anonymous live voice calls with other learners, matched by level and topic. No recordings.'],
  ['🎯', 'Complete IELTS preparation', 'Academic and General Training: Reading, Listening with real audio, Writing and Speaking practice.'],
  ['📝', 'Full mock tests', 'Timed four-skill practice tests with section-by-section results and review.'],
  ['📷', 'Read with AI', 'Photograph a page, tap any word, and see what it means in that sentence.'],
  ['⚔️', 'Vocabulary battles', 'Real-time quiz duels with a separate battle rating and leaderboard.'],
  ['📈', 'Honest progress', 'Placement level, skill estimates and study plans based on what you actually completed.'],
];

export function LandingPage() {
  return (
    <div className="landing stack lg">
      <header className="row between">
        <div className="brand"><span className="brand-mark">◐</span>{APP_NAME}</div>
        <div className="row">
          <Link to="/login" className="btn ghost">Sign in</Link>
          <Link to="/register" className="btn">Create free account</Link>
        </div>
      </header>
      <section className="hero" style={{ padding: 40 }}>
        <div style={{ maxWidth: 620 }}>
          <h2 style={{ fontSize: '2.2rem' }}>Speak English with real people. Prepare for IELTS with confidence.</h2>
          <p style={{ fontSize: '1.1rem' }}>
            Live speaking practice, complete IELTS Academic and General Training preparation, vocabulary, grammar and AI-assisted reading —
            on the web, Android and iOS, with one account.
          </p>
          <div className="row wrap mt">
            <Link to="/register" className="btn lg">Start learning free</Link>
            <Link to="/login" className="btn lg secondary" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.6)' }}>I have an account</Link>
          </div>
        </div>
        <div style={{ fontSize: 120 }} aria-hidden>🗣️</div>
      </section>
      <section className="grid cols-3">
        {FEATURES.map(([ico, t, d]) => (
          <div key={t} className="card feature">
            <span className="ico">{ico}</span>
            <div><h3>{t}</h3><p className="muted small" style={{ margin: 0 }}>{d}</p></div>
          </div>
        ))}
      </section>
      <p className="tiny muted center">
        IELTS is a registered trademark of the IELTS partners. {APP_NAME} is an independent practice platform; scores shown are unofficial practice estimates.
      </p>
    </div>
  );
}

export function GuidelinesPage() {
  return (
    <div className="landing" style={{ maxWidth: 760 }}>
      <Link to="/" className="brand"><span className="brand-mark">◐</span>{APP_NAME}</Link>
      <div className="card pad-lg stack">
        <h1>Community guidelines</h1>
        <p>Live calls connect you with real learners. Everyone deserves a safe, respectful place to practise.</p>
        <h3>Be respectful</h3>
        <ul>
          <li>No harassment, bullying, hate speech, threats or sexual content.</li>
          <li>Be patient with learners of every level. Correct kindly, if your partner wants correction.</li>
        </ul>
        <h3>Protect your privacy</h3>
        <ul>
          <li>You appear with an anonymous name and avatar. Don’t share your phone number, address, social media or payment details.</li>
          <li>Never send money to anyone you meet on the platform.</li>
        </ul>
        <h3>Practise English</h3>
        <ul><li>Calls are for English practice. Spam, advertising and recruiting are not allowed.</li></ul>
        <h3>Age</h3>
        <ul><li>Live calls are only for adults (18+). Younger learners can use every other feature.</li></ul>
        <h3>Reporting and blocking</h3>
        <ul>
          <li>Use <b>Report</b> or <b>Block</b> at any time during or after a call. Blocked users are never matched with you again on any device.</li>
          <li>Moderators review reports. Accounts with repeated valid reports are paused or removed.</li>
        </ul>
        <h3>Recording</h3>
        <p>Calls are <b>not recorded</b>. Audio travels directly between the two participants. Only call metadata (time, duration, topic) is stored for your history and safety.</p>
      </div>
    </div>
  );
}
