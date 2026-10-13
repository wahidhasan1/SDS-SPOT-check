import { config } from '../config';
import { HttpError, notConfigured } from '../lib/errors';

/**
 * Optional server-side speech-to-text via any OpenAI-compatible /audio/transcriptions endpoint
 * (OpenAI Whisper, Groq, or a self-hosted faster-whisper server). Audio is sent to the provider,
 * transcribed and discarded — it is never stored by this application.
 */
export function serverSttAvailable() {
  return !!config.sttApiUrl;
}

export async function transcribe(audio: Buffer, filename: string, mime: string): Promise<{ text: string; durationSec: number | null }> {
  if (!config.sttApiUrl) throw notConfigured('Server-side transcription is not configured (STT_API_URL).');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), filename);
  form.append('model', config.sttModel);
  form.append('language', 'en');
  form.append('response_format', 'verbose_json');
  const res = await fetch(config.sttApiUrl, {
    method: 'POST',
    headers: config.sttApiKey ? { Authorization: `Bearer ${config.sttApiKey}` } : {},
    body: form,
  });
  if (!res.ok) throw new HttpError(502, 'stt_failed', 'Transcription failed. Please try again.');
  const data: any = await res.json();
  return { text: String(data.text ?? '').trim(), durationSec: typeof data.duration === 'number' ? data.duration : null };
}
