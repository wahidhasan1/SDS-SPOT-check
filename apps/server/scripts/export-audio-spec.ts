// Writes the list of audio files to synthesise (used by generate-audio.py).
import { writeFileSync } from 'node:fs';
import { LISTENING_SETS } from '../content/ieltsListening';
import { ASSESSMENT_ITEMS } from '../content/assessment';

const spec = [
  ...LISTENING_SETS.map((s) => ({ out: `listening/${s.slug}.mp3`, lines: s.script })),
  ...ASSESSMENT_ITEMS.filter((i) => i.script).map((i) => ({ out: `assessment/${i.key}.mp3`, lines: [[i.voice ?? 'en-us-amy-low', i.script!]] })),
];
writeFileSync(process.argv[2] ?? 'audio-spec.json', JSON.stringify(spec, null, 1));
console.log(`wrote ${spec.length} audio specs`);
