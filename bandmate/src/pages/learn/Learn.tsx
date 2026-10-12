import { Link } from 'react-router-dom'
import { BookOpenText, Library, ScanText, Swords } from 'lucide-react'
import { Page, PageHeader } from '../../components/ui'

const ITEMS = [
  { to: '/vocab', icon: Library, title: 'Vocabulary', body: 'Topic words, daily challenge and spaced-repetition review.', tone: 'bg-primary-soft text-primary' },
  { to: '/grammar', icon: BookOpenText, title: 'Grammar', body: 'Short lessons from A1 to C1 with practice and explanations.', tone: 'bg-good-soft text-good' },
  { to: '/battles', icon: Swords, title: 'Battles', body: 'Quick word battles against other learners, or practise solo.', tone: 'bg-warn-soft text-warn' },
  { to: '/read', icon: ScanText, title: 'Read with AI', body: 'Photograph a page and tap any word to understand it.', tone: 'bg-talk-soft text-talk' },
]

/** Mobile hub for the learning tools that don't fit in the bottom bar. */
export default function Learn() {
  return (
    <Page>
      <PageHeader title="Learn" subtitle="Build the vocabulary and grammar you need for IELTS and real conversations." />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <Link key={i.to} to={i.to} className="card flex items-start gap-4 p-5 hover:border-primary/40">
            <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${i.tone}`}><i.icon className="size-6" /></span>
            <span>
              <span className="block font-bold">{i.title}</span>
              <span className="block text-sm text-muted">{i.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </Page>
  )
}
