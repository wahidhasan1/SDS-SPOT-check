import { BAND_DISCLAIMER, LEVEL_DISCLAIMER } from '@fluentpath/shared';
import { Info } from 'lucide-react';

export function BandNote() {
  return (
    <p className="muted flex items-start gap-1.5 text-xs">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {BAND_DISCLAIMER}
    </p>
  );
}

export function LevelNote() {
  return (
    <p className="muted flex items-start gap-1.5 text-xs">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {LEVEL_DISCLAIMER}
    </p>
  );
}
