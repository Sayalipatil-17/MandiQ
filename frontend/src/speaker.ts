import { isNative } from './onesignal';
import { type Lang } from './i18n';

const SPEAK_LANG: Record<Lang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  pa: 'pa-IN',
  mr: 'mr-IN',
};

const GOOGLE_TTS_LANG: Record<Lang, string> = {
  en: 'en-IN',
  hi: 'hi',
  pa: 'pa',
  mr: 'mr',
};

let currentAudio: HTMLAudioElement | null = null;
let isCurrentlySpeaking = false;

/**
 * Text ko mobile APK speaker ya browser audio output se bolne ka universal function.
 * 1. Android Capacitor APK me Native Android TextToSpeech engine use karta hai.
 * 2. Fallback me HTML5 Audio Google TTS online stream play karta hai.
 * 3. Browser me window.speechSynthesis use karta hai.
 */
export async function speakText(
  text: string,
  lang: Lang = 'hi',
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  if (!text || !text.trim()) return;
  const cleanText = text.replace(/[*_~`#|]/g, '').trim();

  await stopSpeech();
  isCurrentlySpeaking = true;
  options?.onStart?.();

  // 1. Android Native Capacitor APK
  if (isNative()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      const targetLang = SPEAK_LANG[lang] || 'hi-IN';

      await TextToSpeech.speak({
        text: cleanText,
        lang: targetLang,
        rate: 0.95,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });

      isCurrentlySpeaking = false;
      options?.onEnd?.();
      return;
    } catch (nativeErr) {
      console.warn('[Speaker] Native TTS error, trying audio fallback:', nativeErr);
    }
  }

  // 2. Web Speech API (Desktop / Chrome / Supported Browsers)
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = SPEAK_LANG[lang] || 'hi-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      let ended = false;
      utterance.onend = () => {
        if (!ended) {
          ended = true;
          isCurrentlySpeaking = false;
          options?.onEnd?.();
        }
      };

      utterance.onerror = (e) => {
        if (!ended) {
          ended = true;
          isCurrentlySpeaking = false;
          console.warn('[Speaker] SpeechSynthesis error, trying audio fallback:', e);
          playTtsAudioStream(cleanText, lang, options);
        }
      };

      window.speechSynthesis.speak(utterance);
      return;
    } catch (synthErr) {
      console.warn('[Speaker] Web Speech error, trying audio fallback:', synthErr);
    }
  }

  // 3. HTML5 Audio Stream Fallback (Works universally on all Android WebViews & Browsers)
  playTtsAudioStream(cleanText, lang, options);
}

/**
 * Fallback audio stream playback using Google TTS API
 */
function playTtsAudioStream(
  text: string,
  lang: Lang,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
) {
  try {
    const tl = GOOGLE_TTS_LANG[lang] || 'hi';
    const encoded = encodeURIComponent(text.slice(0, 250));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${tl}&client=tw-ob`;

    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      isCurrentlySpeaking = false;
      options?.onEnd?.();
    };

    audio.onerror = (e) => {
      isCurrentlySpeaking = false;
      options?.onError?.(e);
    };

    audio.play().catch((playErr) => {
      console.warn('[Speaker] Audio stream playback error:', playErr);
      isCurrentlySpeaking = false;
      options?.onError?.(playErr);
    });
  } catch (err) {
    isCurrentlySpeaking = false;
    options?.onError?.(err);
  }
}

/**
 * Speech ya Audio playback ko turant rokne ke liye function
 */
export async function stopSpeech(): Promise<void> {
  isCurrentlySpeaking = false;

  // Stop Native TTS
  if (isNative()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.stop();
    } catch {}
  }

  // Stop Web SpeechSynthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  // Stop HTML5 Audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    } catch {}
  }
}

export function isSpeaking(): boolean {
  return isCurrentlySpeaking;
}
