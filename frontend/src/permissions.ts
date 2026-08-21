import { isNative } from './onesignal';

/**
 * App ke start/installation par saare zaroori permissions ek sath maangne ke liye:
 * 1. Notification (Bhav alert aur update ke liye)
 * 2. Microphone (Voice assistant aur voice search ke liye)
 * 3. Location (GPS aur paas ki mandi ki doori ke liye)
 */
export async function requestAllAppPermissions() {
  console.log('[Permissions] Requesting all essential app permissions...');

  // 1. Notification Permission
  try {
    if (isNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const lPerm = await LocalNotifications.checkPermissions();
      if (lPerm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
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

  // 2. Microphone Permission (Voice search / AI voice support)
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[Permissions] Microphone permission granted');
    }
  } catch (e) {
    console.warn('[Permissions] Microphone error/denied:', e);
  }

  // 3. Location Permission (GPS mandi distance)
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
