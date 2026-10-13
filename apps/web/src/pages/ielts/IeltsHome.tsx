import { Link } from 'react-router';
import { BookOpen, ClipboardList, Headphones, Mic, PenLine } from 'lucide-react';
import { BandNote } from '../../components/learning/Disclaimers';
import { Badge, Card, ChoiceChip, PageHeader, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { useAuth, useMe } from '../../lib/auth';
import type { Me } from '../../lib/types';
import { useApi } from '../../lib/useApi';

export default function IeltsHome() {
  const me = useMe();
  const { setMe } = useAuth();
  const toast = useToast();
  const dash = useApi<{ totals: { reading: { count: number; latestBand: number | null }; listening: { count: number; latestBand: number | null }; writing: { count: number; latestBand: number | null }; speaking: { count: number }; mocksCompleted: number } }>('/api/dashboard');
  const t = dash.data?.totals;
  const setModule = async (m: 'academic' | 'general') => {
    try {
      const r = await api.patch<{ me: Me }>('/api/profile', { ieltsModule: m });
      setMe(r.me);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const cards = [
    { to: '/ielts/reading', icon: BookOpen, title: 'Reading', text: 'Timed passages with every IELTS question type, explanations and band estimates.', stat: t ? `${t.reading.count} completed${t.reading.latestBand != null ? ` · latest ≈ ${t.reading.latestBand}` : ''}` : '' },
    { to: '/ielts/listening', icon: Headphones, title: 'Listening', text: 'Real audio recordings with form, note and sentence completion, multiple choice and matching.', stat: t ? `${t.listening.count} completed${t.listening.latestBand != null ? ` · latest ≈ ${t.listening.latestBand}` : ''}` : '' },
    { to: '/ielts/writing', icon: PenLine, title: 'Writing', text: 'Task 1 and Task 2 with timer, word count, drafts and criteria-based feedback.', stat: t ? `${t.writing.count} submitted${t.writing.latestBand != null ? ` · latest ≈ ${t.writing.latestBand}` : ''}` : '' },
    { to: '/ielts/speaking', icon: Mic, title: 'Speaking', text: 'Part 1 interview, Part 2 cue cards with preparation time, and Part 3 discussion.', stat: t ? `${t.speaking.count} recordings` : '' },
    { to: '/ielts/mock', icon: ClipboardList, title: 'Mock tests', text: 'Full practice tests in exam order with section timers and results.', stat: t ? `${t.mocksCompleted} completed` : '' },
  ];
  return (
    <div>
      <PageHeader eyebrow="IELTS" title="IELTS preparation" description="Practise all four skills with original exam-style material. Choose your module to see the right Reading and Writing tasks." />
      <Card className="mb-6 p-5">
        <div className="mb-3 font-semibold">Your module</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceChip selected={me.profile.ieltsModule === 'academic'} onClick={() => setModule('academic')}><strong>IELTS Academic</strong> <span className="muted text-xs">— university and professional registration</span></ChoiceChip>
          <ChoiceChip selected={me.profile.ieltsModule === 'general'} onClick={() => setModule('general')}><strong>IELTS General Training</strong> <span className="muted text-xs">— work, migration, secondary school</span></ChoiceChip>
        </div>
        <p className="muted mt-3 text-xs">Listening and Speaking are the same for both modules. Reading and Writing differ.</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.to} to={c.to}>
            <Card className="h-full p-5 transition-shadow hover:shadow-md">
              <c.icon className="h-7 w-7 text-brand-600" />
              <h2 className="mt-3 text-lg font-semibold">{c.title}</h2>
              <p className="muted mt-1 text-sm">{c.text}</p>
              {c.stat && <Badge className="mt-3">{c.stat}</Badge>}
            </Card>
          </Link>
        ))}
      </div>
      <div className="mt-6"><BandNote /></div>
    </div>
  );
}
