import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/ui';
import { getAccent } from '@/lib/preferences';
import { useTheme } from '@/providers/theme-provider';

/** Pronunciation via the device's text-to-speech voice (works offline, no API key). */
export function SpeakButton({ text, size = 20 }: { text: string; size?: number }) {
  const { colors } = useTheme();
  const [speaking, setSpeaking] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Pronounce ${text}`}
      hitSlop={10}
      onPress={async () => {
        Speech.stop();
        setSpeaking(true);
        Speech.speak(text, { language: await getAccent(), rate: 0.9, onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
      }}
      style={{ width: size + 18, height: size + 18, borderRadius: 999, backgroundColor: speaking ? colors.primary : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="volume-high" size={size} rawColor={speaking ? colors.primaryText : colors.primary} />
    </Pressable>
  );
}
