/**
 * Generates listening audio and word pronunciation files from the seed content using
 * espeak-ng with MBROLA voices + ffmpeg. Output is committed to apps/api/media so the app
 * works without any TTS service at runtime.
 *
 *   apt-get install espeak-ng mbrola-us1 mbrola-us2 mbrola-us3 mbrola-en1 ffmpeg
 *   npm run audio:generate -w apps/api            # only missing files
 *   npm run audio:generate -w apps/api -- --force # regenerate everything
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { API_ROOT } from '../config';
import { listeningSets } from '../seed/content/ielts-listening';
import { vocabulary } from '../seed/content/vocabulary';

const force = process.argv.includes('--force');
const outListening = path.join(API_ROOT, 'media/listening');
const outWords = path.join(API_ROOT, 'media/words');
fs.mkdirSync(outListening, { recursive: true });
fs.mkdirSync(outWords, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-audio-'));

export function wordAudioFile(word: string) {
  return `${word.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.mp3`;
}

function speak(voice: string, text: string, out: string, speed = 150) {
  execFileSync('espeak-ng', ['-v', voice, '-s', String(speed), '-w', out, text]);
}

function silence(sec: number, out: string) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `anullsrc=r=16000:cl=mono`, '-t', String(sec), out]);
}

function toMp3(inputs: string[], out: string) {
  const list = path.join(tmp, `list-${Date.now()}.txt`);
  // Normalise every piece to 16 kHz mono first so concat works.
  const norm = inputs.map((f, i) => {
    const n = path.join(tmp, `n-${i}-${path.basename(f)}`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-ar', '16000', '-ac', '1', n]);
    return n;
  });
  fs.writeFileSync(list, norm.map((f) => `file '${f}'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-ar', '22050', '-ac', '1', '-b:a', '48k', out]);
}

let made = 0;
for (const set of listeningSets) {
  for (const section of set.sections) {
    const file = path.join(outListening, `${set.slug}-${section.id}.mp3`);
    if (!force && fs.existsSync(file)) continue;
    const pieces: string[] = [];
    const lead = path.join(tmp, 'lead.wav');
    silence(1.5, lead);
    pieces.push(lead);
    const gap = path.join(tmp, 'gap.wav');
    silence(0.7, gap);
    section.transcript.split('\n').forEach((line, i) => {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (!m) return;
      const voice = section.voices[m[1].trim()];
      if (!voice) throw new Error(`No voice for speaker "${m[1]}" in ${set.slug}/${section.id}`);
      const wav = path.join(tmp, `${set.slug}-${section.id}-${i}.wav`);
      speak(voice, m[2], wav, 148);
      pieces.push(wav, gap);
    });
    toMp3(pieces, file);
    made++;
    console.log('listening:', path.relative(API_ROOT, file));
  }
}

for (const w of vocabulary) {
  const file = path.join(outWords, wordAudioFile(w.word));
  if (!force && fs.existsSync(file)) continue;
  const wav = path.join(tmp, 'w.wav');
  speak('mb-us1', w.word, wav, 130);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-ar', '22050', '-ac', '1', '-b:a', '40k', file]);
  made++;
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Done. Generated ${made} file(s).`);
