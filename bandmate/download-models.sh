#!/usr/bin/env bash
# Downloads the offline speech models (not committed: ~400 MB). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/models"
base=https://github.com/k2-fsa/sherpa-onnx/releases/download
get() { local name=$1 url=$2; [ -d "$name" ] && { echo "✓ $name"; return; }; echo "↓ $name"; curl -sSfL "$url" | tar xj; }
get sherpa-onnx-whisper-base.en "$base/asr-models/sherpa-onnx-whisper-base.en.tar.bz2"
# Voices are limited to licences that allow commercial use (see content/CREDITS.md).
get vits-piper-en_GB-alba-medium "$base/tts-models/vits-piper-en_GB-alba-medium.tar.bz2"
get vits-piper-en_GB-cori-medium "$base/tts-models/vits-piper-en_GB-cori-medium.tar.bz2"
get vits-piper-en_GB-northern_english_male-medium "$base/tts-models/vits-piper-en_GB-northern_english_male-medium.tar.bz2"
get vits-piper-en_US-libritts_r-medium "$base/tts-models/vits-piper-en_US-libritts_r-medium.tar.bz2"
[ -f silero_vad.onnx ] || { echo "↓ silero_vad.onnx"; curl -sSfL -o silero_vad.onnx "$base/asr-models/silero_vad.onnx"; }
echo "Models ready in $(pwd)"
