import { api } from './api';

export interface SpeakingAttemptResp {
  attempt: { id: string; title: string; score: number | null; metrics: Record<string, unknown>; feedback: { aiStatus?: string } | null };
  newAchievements?: { title: string }[];
  rules?: string;
}

/** Upload a speaking answer. Text fields are sent before the file (required by the server parser). */
export function uploadSpeaking(fields: Record<string, string | number | undefined>, audio: Blob | null) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) fd.append(k, String(v));
  if (audio) {
    const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm';
    fd.append('audio', audio, `answer.${ext}`);
  }
  return api.post<SpeakingAttemptResp>('/api/speaking/attempts', fd);
}
