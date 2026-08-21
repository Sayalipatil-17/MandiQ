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

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** APK mein local notification trigger karo (alert set hone par ya alert trigger hone par) */
export async function showLocalNotification(title: string, body: string) {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Math.random() * 100000) + 1,
          title,
          body,
          schedule: { at: new Date(Date.now() + 300) },
          smallIcon: 'ic_stat_mandiq',
          iconColor: '#2d6a3e',
        }]
      });
    } catch (e) {
      console.warn('Local notification schedule error:', e);
    }
  } else {
    // Browser fallback
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: '/app-icon.png' }); } catch {}
    }
  }
}

/** Triggered alerts fetch karke naye triggered alerts ke liye Android notification fire karo */
export async function checkAndNotifyTriggeredAlerts() {
  const token = localStorage.getItem('mandiq_token');
  if (!token) return;
  try {
    const res = await fetch(`${BASE_URL}/api/alerts?triggered=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return;
    const triggeredAlerts = await res.json();
    if (!Array.isArray(triggeredAlerts) || triggeredAlerts.length === 0) return;

    let notifiedIds: number[] = [];
    try {
      const saved = localStorage.getItem('mandiq_notified_alert_ids');
      if (saved) notifiedIds = JSON.parse(saved);
    } catch {}

    for (const alert of triggeredAlerts) {
      if (!notifiedIds.includes(alert.id)) {
        const crop = alert.crop || 'फसल';
        const price = alert.target_price ? `₹${alert.target_price}` : '';
        const direction = alert.direction === 'below' ? 'नीचे' : (alert.direction === 'best_day' ? 'बेचने का सबसे अच्छा दिन' : 'ऊपर');
        
        let title = `🔔 मंडी अलर्ट: ${crop}`;
        let body = alert.direction === 'best_day'
          ? `आज ${crop} बेचने का सबसे उत्तम दिन है!`
          : `${crop} का भाव ${price} से ${direction} पहुँच गया है!`;

        await showLocalNotification(title, body);
        notifiedIds.push(alert.id);
      }
    }
    localStorage.setItem('mandiq_notified_alert_ids', JSON.stringify(notifiedIds));
  } catch (e) {
    console.warn('checkAndNotifyTriggeredAlerts error:', e);
  }
}
