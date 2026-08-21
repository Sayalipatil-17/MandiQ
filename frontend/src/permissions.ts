import { isNative } from './onesignal';

/**
 * App ke installation/start par hi saari permissions upfront maangne ke liye:
 * 1. Push & Local Notifications (channel setup ke sath)
 * 2. Microphone (Voice Chat aur Speech search ke liye)
 * 3. Location (GPS location ke liye)
 */
export async function requestAllAppPermissions() {
  console.log('[Permissions] Requesting all essential app permissions upfront...');

  // 1. Notification Permission & High-Priority Channel Setup
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

  // 2. Microphone Permission (Voice assistant / Voice search)
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      console.log('[Permissions] Microphone permission granted');
    }
  } catch (e) {
    console.warn('[Permissions] Microphone error/denied:', e);
  }

  // 3. Location Permission (GPS Mandi distance)
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
