import { Mic, RotateCcw, Square } from 'lucide-react';
import { Alert, Button } from '../ui';
import type { useRecorder } from '../../lib/recorder';

type Rec = ReturnType<typeof useRecorder>;

/** Recording controls + transcript editor shared by IELTS speaking, mock tests and challenges. */
export function RecorderPanel({ rec, maxSeconds, disabled }: { rec: Rec; maxSeconds?: number; disabled?: boolean }) {
  const mm = Math.floor(rec.seconds / 60);
  const ss = String(rec.seconds % 60).padStart(2, '0');
  return (
    <div className="space-y-3">
      {rec.error && <Alert tone={rec.state === 'error' ? 'error' : 'warning'}>{rec.error}</Alert>}
      {!rec.recognitionSupported && (
        <Alert tone="info">Live transcription is not available in this browser (it works in Chrome, Edge and Safari). You can still record, and type what you said below to get statistics and feedback.</Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {rec.state !== 'recording' ? (
          <Button onClick={rec.start} disabled={disabled || rec.state === 'requesting'} loading={rec.state === 'requesting'} icon={<Mic className="h-4 w-4" />} variant={rec.state === 'stopped' ? 'secondary' : 'primary'}>
            {rec.state === 'stopped' ? 'Record again' : 'Start recording'}
          </Button>
        ) : (
          <Button variant="danger" onClick={rec.stop} icon={<Square className="h-4 w-4" />}>Stop</Button>
        )}
        {rec.state === 'recording' && (
          <span className="flex items-center gap-2 font-mono text-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" /> {mm}:{ss}{maxSeconds ? ` / ${Math.floor(maxSeconds / 60)}:${String(maxSeconds % 60).padStart(2, '0')}` : ''}
          </span>
        )}
        {rec.state === 'stopped' && <Button variant="ghost" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={rec.reset}>Discard</Button>}
      </div>
      {rec.url && <audio controls src={rec.url} className="w-full" />}
      {(rec.state === 'recording' || rec.state === 'stopped') && (
        <div>
          <label className="label" htmlFor="transcript">Transcript {rec.recognitionSupported ? '(automatic — you can correct it)' : '(type what you said)'}</label>
          <textarea id="transcript" className="input min-h-[100px] text-sm" value={rec.transcript + (rec.interim ? ` ${rec.interim}` : '')} onChange={(e) => rec.setTranscript(e.target.value)} readOnly={rec.state === 'recording'} placeholder={rec.state === 'recording' ? 'Listening…' : 'No speech recognised yet.'} />
        </div>
      )}
    </div>
  );
}
