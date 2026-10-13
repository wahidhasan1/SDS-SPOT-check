import { Link } from 'react-router-dom'
import { Logo } from '../../components/Logo'
import { appName } from '../../lib/session'

const name = appName()

const PAGES = {
  guidelines: {
    title: 'Community guidelines',
    intro: `Voice calls on ${name} are for practising English with other learners. Everyone deserves a safe, friendly space to make mistakes and improve.`,
    sections: [
      ['Be kind and patient', 'Your partner is learning too. Speak clearly, give them time to answer, and correct mistakes gently — only if they want you to.'],
      ['Keep it anonymous', 'Don’t ask for or share real names, phone numbers, addresses, social media accounts or other contact details. Never send money or personal documents.'],
      ['No harassment or hate', 'No insults, threats, sexual content, hate speech or discrimination of any kind. No spam, selling or recruiting.'],
      ['Adults only on calls', 'Voice calls are only for people aged 18 or over. If you think you are speaking with a child, end the call and report it.'],
      ['Report problems', 'Use Report or Block during or after any call. Blocked users can never be matched with you again. Reports are reviewed by our team, and repeated reports pause the other person’s calls automatically.'],
      ['Calls are not recorded', 'We never record or store call audio. Audio goes directly between the two of you, encrypted (and through an encrypted relay server only when your network needs one).'],
      ['Practice, not exams', 'Peer calls are practice conversations. They are not official IELTS speaking tests and your partner is not an examiner.'],
    ],
  },
  privacy: {
    title: 'Privacy policy (summary)',
    intro: `This is a plain-language summary of what ${name} stores and why. The operator of this service must publish their full policy and contact details before launch.`,
    sections: [
      ['What we store', 'Your email, a password hash (never the password), your first name, year of birth, learning goals, practice answers, essays, speaking transcripts, saved words, call history (time, length, topic — never audio), reports and blocks.'],
      ['What partners see', 'Only your anonymous name, avatar and — if you allow it — your English level. Never your email, real name or account details.'],
      ['Voice calls', 'Audio travels directly between you and your partner using encrypted WebRTC. It is never recorded. The server only sees connection messages needed to set up the call.'],
      ['Speaking practice', 'When you ask for speaking feedback, your recording is sent to our server, transcribed by our own speech-recognition software and then deleted. We keep the text transcript in your history; you can delete your account at any time.'],
      ['Photos for reading', 'Photos are processed on our server to extract text and then deleted. The extracted text is kept in your reading history so you can review words.'],
      ['Optional AI services', 'If the operator enables an external AI provider, your essay text, or a word with its sentence, may be sent to that provider to generate feedback, explanations or translations. You will be asked before this happens.'],
      ['Your rights', 'You can download your data and permanently delete your account from Profile → Privacy & data.'],
    ],
  },
  terms: {
    title: 'Terms of use (summary)',
    intro: `By using ${name} you agree to these basic rules. The operator must publish complete terms before launch.`,
    sections: [
      ['Eligibility', 'You must be at least 13 to use the app and at least 18 to use voice calls with other users.'],
      ['Your behaviour', 'Follow the community guidelines. We may pause or close accounts that break them.'],
      ['Practice scores', 'Band scores, levels and feedback in the app are practice estimates. They are not official IELTS results and do not predict your exam result.'],
      ['Not affiliated', `${name} is independent and not affiliated with, or endorsed by, the IELTS partners (British Council, IDP and Cambridge University Press & Assessment).`],
      ['Subscriptions', 'Paid plans are processed by the payment provider shown at checkout. Premium access starts only after the provider confirms payment.'],
    ],
  },
} as const

export default function Legal({ page }: { page: keyof typeof PAGES }) {
  const p = PAGES[page]
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link to="/"><Logo /></Link>
      <h1 className="h1 mt-8">{p.title}</h1>
      <p className="mt-2 text-muted">{p.intro}</p>
      <div className="mt-6 space-y-5">
        {p.sections.map(([h, b]) => (
          <section key={h}>
            <h2 className="h2">{h}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-muted">{b}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm"><Link to="/" className="link">← Back</Link></p>
    </div>
  )
}
