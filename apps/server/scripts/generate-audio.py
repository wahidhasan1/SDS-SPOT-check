#!/usr/bin/env python3
"""Synthesise listening audio with Piper neural TTS (offline) and encode to MP3 with ffmpeg.

Usage: python3 generate-audio.py <audio-spec.json> <media-dir> <piper-voices-dir>
Voices: download Piper voices (e.g. en-gb-alan-low, en-us-amy-low) into <piper-voices-dir>.
"""
import json, os, subprocess, sys, tempfile, wave

spec_path, media_dir, voices_dir = sys.argv[1], sys.argv[2], sys.argv[3]
spec = json.load(open(spec_path))

def synth(voice: str, text: str, out_wav: str):
    model = os.path.join(voices_dir, voice + '.onnx')
    subprocess.run([sys.executable, '-m', 'piper', '-m', model, '-f', out_wav, '--sentence-silence', '0.25'],
                   input=text.encode(), check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

for item in spec:
    out = os.path.join(media_dir, item['out'])
    if os.path.exists(out) and '--force' not in sys.argv:
        print('skip', item['out']); continue
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        parts = []
        for i, (voice, text) in enumerate(item['lines']):
            p = os.path.join(td, f'{i:03d}.wav')
            synth(voice, text, p)
            parts.append(p)
        # Normalise every clip to 22.05 kHz mono and insert natural pauses between turns.
        listfile = os.path.join(td, 'list.txt')
        silence = os.path.join(td, 'sil.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=22050:cl=mono', '-t', '0.7', silence], check=True)
        norm = []
        for p in parts:
            q = p.replace('.wav', '-n.wav')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', p, '-ar', '22050', '-ac', '1', q], check=True)
            norm.append(q)
        with open(listfile, 'w') as f:
            f.write(f"file '{silence}'\n")
            for q in norm:
                f.write(f"file '{q}'\nfile '{silence}'\n")
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listfile,
                        '-af', 'loudnorm=I=-18:TP=-2', '-ac', '1', '-ar', '22050', '-b:a', '48k', out], check=True)
    print('wrote', item['out'])
