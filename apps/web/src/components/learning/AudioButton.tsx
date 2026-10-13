import { useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';

export function AudioButton({ src, label = 'Play pronunciation' }: { src: string | null | undefined; label?: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  if (!src) return null;
  return (
    <button
      type="button"
      onClick={() => {
        ref.current ??= new Audio(src);
        ref.current.onended = () => setPlaying(false);
        ref.current.currentTime = 0;
        ref.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }}
      className={`rounded-full p-1.5 transition-colors hover:bg-brand-50 dark:hover:bg-brand-900/40 ${playing ? 'text-brand-700' : 'text-brand-600'}`}
      aria-label={label}
      title={label}
    >
      <Volume2 className="h-4 w-4" />
    </button>
  );
}
