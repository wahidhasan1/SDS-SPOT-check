import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getToken, mediaUrl } from './api';

let current: AudioPlayer | null = null;

/** Play an audio URL from the API (public media or the user's own private recordings). */
export async function playUrl(path: string) {
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  current?.remove();
  const token = getToken();
  const isPrivate = path.startsWith('/api/media/');
  current = createAudioPlayer(isPrivate && token ? { uri: mediaUrl(path), headers: { authorization: `Bearer ${token}` } } : { uri: mediaUrl(path) });
  current.play();
  return current;
}

export function stopAudio() {
  current?.pause();
}
