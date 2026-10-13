import { BookOpen, Headphones, Mic, PenLine, Phone, ScanText, Shield, Swords, Library, GraduationCap, BarChart3, Sparkles } from 'lucide-react';
import { ButtonLink } from '../../components/ui';

const features = [
  { icon: GraduationCap, title: 'Complete IELTS preparation', text: 'Academic and General Training practice for Reading, Listening, Writing and Speaking, plus timed mock tests.' },
  { icon: Phone, title: 'Anonymous voice practice', text: 'Get matched with another learner and talk in real time. You appear under a random name — no emails or profiles shared.' },
  { icon: Swords, title: 'Battles and challenges', text: 'Live vocabulary and grammar battles against other learners, plus timed speaking challenges with clear scoring rules.' },
  { icon: ScanText, title: 'Read any book page', text: 'Photograph a page, get the text with OCR, tap any word to see its meaning in context and save it.' },
  { icon: Library, title: 'Vocabulary that sticks', text: 'Daily words, IELTS topic lists, flashcards and spaced repetition that tracks what you are learning and mastering.' },
  { icon: BookOpen, title: 'Structured grammar', text: 'Beginner, intermediate and advanced paths with clear explanations, examples and checked practice questions.' },
  { icon: PenLine, title: 'Writing feedback', text: 'Write Task 1 and Task 2 answers with a timer and word count, save drafts and get criteria-based feedback.' },
  { icon: BarChart3, title: 'Real progress tracking', text: 'Streaks, scores, vocabulary progress and practice history — all calculated from what you actually do.' },
];

export default function Landing() {
  return (
    <div>
      <section className="bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-950/40">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" /> English from beginner to advanced
            </span>
            <h1 className="mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
              Learn English. <span className="text-brand-600">Ace IELTS.</span> Speak with real people.
            </h1>
            <p className="muted mt-5 max-w-xl text-lg">
              FluentPath combines structured lessons, IELTS practice tests, vocabulary training and anonymous voice conversations with other learners — in one place, on web, Android and iOS.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/register" size="lg">Create a free account</ButtonLink>
              <ButtonLink to="/login" size="lg" variant="secondary">I already have an account</ButtonLink>
            </div>
            <p className="muted mt-4 text-sm">Free plan included. Start with a short placement assessment to estimate your level.</p>
          </div>
          <div className="card p-6">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: BookOpen, label: 'Reading', text: 'TFNG, matching headings, completion' },
                { icon: Headphones, label: 'Listening', text: 'Real audio with timed questions' },
                { icon: PenLine, label: 'Writing', text: 'Task 1 & 2 with feedback' },
                { icon: Mic, label: 'Speaking', text: 'Parts 1–3 with recordings' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
                  <m.icon className="h-6 w-6 text-brand-600" />
                  <div className="mt-2 font-semibold">{m.label}</div>
                  <div className="muted text-sm">{m.text}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
              <Shield className="h-6 w-6 shrink-0 text-emerald-600" />
              <p className="text-sm">Voice partners only see a random name like <strong>“Calm Otter 42”</strong>. Block or report anyone with one tap.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl font-bold">Everything you need to improve</h2>
        <p className="muted mx-auto mt-3 max-w-2xl text-center">Practise every skill, track real progress and get help when you need it.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card p-5">
              <f.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="muted mt-1 text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="ielts" className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">IELTS Academic or General Training</h2>
            <p className="muted mt-3">Choose your module and practise with question types you will meet in the exam. Every answer is checked, explained and saved to your history.</p>
            <ul className="mt-6 space-y-2 text-sm">
              {['Reading: multiple choice, True/False/Not Given, Yes/No/Not Given, matching headings and information, sentence, summary and short-answer questions', 'Listening: playable audio with form, note and sentence completion, multiple choice and matching', 'Writing: charts, tables, maps, processes, letters and essays with word count and drafts', 'Speaking: Part 1 interview, Part 2 cue cards with preparation time, Part 3 discussion', 'Mock tests with section timers, answer saving and results review'].map((t) => (
                <li key={t} className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="card self-start p-6">
            <h3 className="font-semibold">Honest about scores</h3>
            <p className="muted mt-2 text-sm">
              Band scores in FluentPath are unofficial estimates to help you practise. Your level (A1–C2) is estimated from your placement answers and is not an official CEFR certificate. Practice content is original and not produced by the IELTS partners.
            </p>
            <div className="mt-6">
              <ButtonLink to="/register">Start practising free</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
