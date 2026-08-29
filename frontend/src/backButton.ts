import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// In-app screens jahan se peeche jaane ka matlab hai "app se bahar" —
// yahan se hardware/gesture back dabane par app minimize honi chahiye, close nahi.
const ROOT_PATHS = ['/home', '/login', '/'];

/**
 * Kuch Android phones me physical back button hota hai, kuch me gesture navigation.
 * Dono cases me Capacitor same 'backButton' event fire karta hai — isliye ek hi
 * listener se sab devices pe consistent back-navigation milta hai.
 */
export function setupHardwareBackButton() {
  if (!Capacitor.isNativePlatform()) return;

  CapacitorApp.addListener('backButton', () => {
    const path = window.location.pathname;
    if (window.history.length > 1 && !ROOT_PATHS.includes(path)) {
      window.history.back();
    } else {
      CapacitorApp.minimizeApp();
    }
  });
}
