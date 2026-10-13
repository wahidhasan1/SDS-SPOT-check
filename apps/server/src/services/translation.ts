import { config } from '../config';
import { HttpError, notConfigured } from '../lib/errors';
import { aiAvailable, aiTranslate } from './ai';

const LANG_CODES: Record<string, string> = {
  arabic: 'ar', bengali: 'bn', bangla: 'bn', chinese: 'zh', french: 'fr', german: 'de', hindi: 'hi', indonesian: 'id', italian: 'it',
  japanese: 'ja', korean: 'ko', persian: 'fa', farsi: 'fa', polish: 'pl', portuguese: 'pt', russian: 'ru', spanish: 'es', tamil: 'ta',
  thai: 'th', turkish: 'tr', ukrainian: 'uk', urdu: 'ur', vietnamese: 'vi', nepali: 'ne', malay: 'ms', swahili: 'sw', dutch: 'nl',
};

export function translationAvailable() {
  return aiAvailable() || !!config.libreTranslateUrl;
}

export async function translate(text: string, targetLanguage: string, context?: string): Promise<{ translation: string; notes: string | null; provider: string }> {
  if (aiAvailable()) {
    const r = await aiTranslate(text, targetLanguage, context);
    return { ...r, provider: 'claude' };
  }
  if (config.libreTranslateUrl) {
    const code = LANG_CODES[targetLanguage.toLowerCase()] ?? targetLanguage.toLowerCase().slice(0, 2);
    const res = await fetch(config.libreTranslateUrl.replace(/\/$/, '') + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: code, format: 'text', api_key: config.libreTranslateKey || undefined }),
    });
    if (!res.ok) throw new HttpError(502, 'translation_failed', 'The translation service could not translate this text.');
    const data: any = await res.json();
    return { translation: data.translatedText, notes: null, provider: 'libretranslate' };
  }
  throw notConfigured('Translation is not configured on this server (set ANTHROPIC_API_KEY or LIBRETRANSLATE_URL).');
}
