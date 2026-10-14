import type { Metadata } from "next";
import { SimplePage } from "@/components/marketing/simple-page";

export const metadata: Metadata = { title: "Privacy" };

const SECTIONS = [
  ["What Pantora stores", "Your display name, avatar color, level estimate, goals, settings, and your practice records: sessions, transcripts (if you enable captions and keep transcripts), feedback, saved sentences, XP, achievements, blocks, and reports."],
  ["What Pantora doesn't ask for", "No real name, email, phone number, payment details, photo, or location is required."],
  ["Audio", "Free Talk calls are not recorded. In demo mode, your microphone is only used on your device for the level meter. Battle and coach recordings stay in your browser and are discarded when you leave the page, unless you choose to send one to a configured speech-to-text service."],
  ["Live captions", "Captions use your browser's built-in speech recognition. In Chrome, this sends audio to Google's speech service. The resulting text is saved with your session unless you turn off transcript retention."],
  ["AI feedback", "When an AI provider is configured, the text of your answer (not audio) is sent from Pantora's server to that provider for analysis. In demo mode, analysis runs locally with transparent rules."],
  ["Your controls", "Choose transcript retention (keep, 30 days, or don't keep), hide partner names in your history, hide your display name from live partners, and delete your account and all its data from Settings."],
  ["This demo", "This build stores data in a local SQLite database on the machine running Pantora, and identifies you with a browser cookie. It is not a production service."],
];

export default function PrivacyPage() {
  return (
    <SimplePage title="Privacy overview" intro="A plain-language summary of what this Pantora build stores and how you control it.">
      {SECTIONS.map(([title, body]) => (
        <section key={title}>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
        </section>
      ))}
    </SimplePage>
  );
}
