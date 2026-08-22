import { isNative } from './onesignal';

// Global AudioContext singleton to keep speaker pipeline active
let sharedAudioContext: AudioContext | null = null;
let speakerUnlocked = false;

/**
 * Speaker aur Audio subsystem ko unlock aur warm-up karne ke liye function.
 * Browser autoplay policy aur Android WebView audio restrictions ko remove karta hai.
 */
export async function unlockSpeakerAudio(): Promise<boolean> {
  if (speakerUnlocked && sharedAudioContext && sharedAudioContext.state === 'running') {
    return true;
  }

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!sharedAudioContext) {
        sharedAudioContext = new AudioCtx();
      }
      if (sharedAudioContext.state === 'suspended') {
        await sharedAudioContext.resume();
      }

      // Short silent buffer play karke speaker channel open karte hain
      const buffer = sharedAudioContext.createBuffer(1, 1, 22050);
      const source = sharedAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(sharedAudioContext.destination);
      source.start(0);
    }

    // Native Android TTS engine warm-up
    if (isNative()) {
      try {
        const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
        await TextToSpeech.getSupportedLanguages().catch(() => {});
      } catch {}
    }

    speakerUnlocked = true;
    console.log('[Permissions] Speaker audio pipeline unlocked & initialized successfully');
    return true;
  } catch (e) {
    console.warn('[Permissions] Speaker audio unlock error:', e);
    return false;
  }
}

// User ke pehle click / touch par speaker unlock guarantee karne ke liye event listeners
if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockSpeakerAudio().catch(() => {});
    window.removeEventListener('click', handleFirstInteraction, true);
    window.removeEventListener('touchstart', handleFirstInteraction, true);
    window.removeEventListener('keydown', handleFirstInteraction, true);
  };
  window.addEventListener('click', handleFirstInteraction, true);
  window.addEventListener('touchstart', handleFirstInteraction, true);
  window.addEventListener('keydown', handleFirstInteraction, true);
}

/**
 * App ke installation/start par hi saari permissions upfront maangne ke liye:
 * 1. Speaker & Audio Output (Voice playback, TTS, Mandi alerts audio ke liye)
 * 2. Push & Local Notifications (channel setup ke sath)
 * 3. Microphone (Voice Chat aur Speech search ke liye)
 * 4. Location (GPS location ke liye)
 */
export async function requestAllAppPermissions() {
  console.log('[Permissions] Requesting all essential app permissions upfront (Speaker, Mic, Notifications, Location)...');

  // 1. Speaker / Audio Output Permission & Pipeline Unlock
  try {
    // Check W3C speaker-selection permission if supported
    if (navigator.permissions && typeof (navigator.permissions as any).query === 'function') {
      try {
        const speakerStatus = await (navigator.permissions as any).query({ name: 'speaker-selection' });
        console.log('[Permissions] Speaker selection permission status:', speakerStatus.state);
      } catch {
        // speaker-selection query is not supported in all browsers, which is normal
      }
    }

    // Modern Audio Output device permission (if supported)
    if (navigator.mediaDevices && typeof (navigator.mediaDevices as any).selectAudioOutput === 'function') {
      try {
        await (navigator.mediaDevices as any).selectAudioOutput();
        console.log('[Permissions] Audio output device selected/granted');
      } catch (err) {
        console.warn('[Permissions] Audio output device select prompt dismissed or not needed:', err);
      }
    }

    // Unlock AudioContext and speech synthesizer speaker
    await unlockSpeakerAudio();
  } catch (e) {
    console.warn('[Permissions] Speaker permission error:', e);
  }

  // 2. Notification Permission & High-Priority Channel Setup
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      
      // Notification Channel banao taaki sound, vibration, aur heads-up popup enabled rahe
      try {
        await LocalNotifications.createChannel({
          id: 'mandi_alerts',
          name: 'Mandi Bhav Alerts',
          description: 'Mandi price alerts and daily predictions',
          importance: 5, // MAX importance for popup & sound
          visibility: 1,
          vibration: true,
          sound: 'default',
          lights: true,
          lightColor: '#2d6a3e',
        });
      } catch (e) {
        console.warn('[Permissions] Channel creation error:', e);
      }

      // Permission check & request
      const lPerm = await LocalNotifications.checkPermissions();
      if (lPerm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      // OneSignal push permission
      try {
        const { OneSignal } = await import('@onesignal/capacitor-plugin');
        await OneSignal.requestPermission();
      } catch {}
    } else {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  } catch (e) {
    console.warn('[Permissions] Notification error:', e);
  }

  // 3. Microphone Permission (Voice assistant / Voice search)
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[Permissions] Microphone permission granted');
    }
  } catch (e) {
    console.warn('[Permissions] Microphone error/denied:', e);
  }

  // 4. Location Permission (GPS Mandi distance)
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log('[Permissions] Location permission granted:', pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('[Permissions] Location error/denied:', err.message);
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 120000 }
      );
    }
  } catch (e) {
    console.warn('[Permissions] Location error:', e);
  }
}
