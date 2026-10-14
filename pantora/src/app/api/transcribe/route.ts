import { apiUser, fail, handler, ok } from "@/server/http";
import { SttError, sttConfigured, transcribeAudio } from "@/server/stt";

/** Transcribes a short recording when a speech-to-text provider is configured. Audio is not stored. */
export const POST = handler(async (request: Request) => {
  await apiUser();
  if (!sttConfigured()) {
    return fail(501, "Server speech-to-text is not configured. Use your browser's captions or type what you said.", { code: "stt_not_configured" });
  }
  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return fail(400, "Attach a recording in the 'audio' field.");
  try {
    const text = await transcribeAudio(audio, audio instanceof File && audio.name ? audio.name : "recording.webm");
    if (!text) return fail(422, "No speech was detected in the recording.");
    return ok({ text, provider: "stt" });
  } catch (error) {
    return fail(502, error instanceof SttError ? error.message : "Transcription failed.");
  }
});

export async function GET() {
  return ok({ configured: sttConfigured() });
}
