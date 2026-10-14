import "server-only";
import { config } from "./config";

// Optional server-side speech-to-text through any OpenAI-compatible
// `/audio/transcriptions` endpoint (configure with PANTORA_STT_* variables).
// Audio is forwarded for transcription and is not stored by Pantora.

export function sttConfigured() {
  return Boolean(config.stt.apiKey);
}

export class SttError extends Error {}

export async function transcribeAudio(file: Blob, filename: string): Promise<string> {
  if (!config.stt.apiKey) throw new SttError("Speech-to-text is not configured on this server.");
  if (file.size > config.stt.maxBytes) throw new SttError("The recording is too large to transcribe (8 MB maximum).");
  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", config.stt.model);
  form.append("language", "en");
  form.append("response_format", "json");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${config.stt.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.stt.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) throw new SttError(`The transcription service returned an error (${res.status}).`);
    const data = (await res.json()) as { text?: unknown };
    if (typeof data.text !== "string") throw new SttError("The transcription service returned an unexpected response.");
    return data.text.trim();
  } catch (error) {
    if (error instanceof SttError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new SttError("The transcription service took too long to respond.");
    throw new SttError("Could not reach the transcription service.");
  } finally {
    clearTimeout(timer);
  }
}
