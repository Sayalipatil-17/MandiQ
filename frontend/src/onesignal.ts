/**
 * onesignal.ts — Unified notification wrapper
 * - APK (Capacitor + FCM): @onesignal/capacitor-plugin — background notifications work
 * - Browser (PWA/web): window.OneSignalDeferred web push
 */

import { Capacitor } from '@capacitor/core';

const APP_ID = '6ad18ee9-92e5-4519-a38d-c16d2c8c0eda';

export function isNative() {
  return Capacitor.isNativePlatform();
}

export async function initOneSignal() {
  if (isNative()) {
    const { OneSignal } = await import('@onesignal/capacitor-plugin');
    OneSignal.initialize(APP_ID);
    // Android 13+ ke liye permission maango
    const { value } = await OneSignal.requestPermission();
    console.log('[OneSignal] Permission granted:', value);
    return;
  }
  // Browser — index.html script tag handles it
}

export async function loginOneSignal(userId: number) {
  if (isNative()) {
    const { OneSignal } = await import('@onesignal/capacitor-plugin');
    try { await OneSignal.login(String(userId)); } catch {}
  } else {
    const os = (window as any).OneSignalDeferred;
    if (!os) return;
    os.push(async (OneSignal: any) => {
      try { await OneSignal.login(String(userId)); } catch {}
    });
  }
}

export async function logoutOneSignal() {
  if (isNative()) {
    const { OneSignal } = await import('@onesignal/capacitor-plugin');
    try { await OneSignal.logout(); } catch {}
  } else {
    const os = (window as any).OneSignalDeferred;
    if (!os) return;
    os.push(async (OneSignal: any) => {
      try { await OneSignal.logout(); } catch {}
    });
  }
}

/** APK mein local confirmation notification (alert set hone par) */
export async function showLocalNotification(title: string, body: string) {
  if (!isNative()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  await LocalNotifications.schedule({
    notifications: [{
      id: Math.floor(Math.random() * 10000),
      title,
      body,
      schedule: { at: new Date(Date.now() + 300) },
      smallIcon: 'ic_stat_mandiq',
      iconColor: '#2d6a3e',
    }]
  });
}
