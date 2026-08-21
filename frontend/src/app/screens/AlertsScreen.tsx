import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Bell, Target, TrendingUp, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { SupportChat } from '../components/SupportChat';
import { useT, cropName } from '../../i18n';
import { showLocalNotification } from '../../onesignal';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };

type Alert = { id: number; crop: string; market: string; target_price: number; direction: string; created_at: string };

function authHeaders() {
  const token = localStorage.getItem('mandiq_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function AlertsScreen() {
  const nav = useNavigate();
  const { t } = useT();
  const crop = localStorage.getItem('selectedCrop') || 'Tomato';

  const [tp, setTp] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(crop);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);
  const [bestDay, setBestDay] = useState(() => localStorage.getItem('bestDayAlert') === 'on');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [notifDenied, setNotifDenied] = useState(false);
  const [userCrops, setUserCrops] = useState<string[]>(() => {
    const saved = localStorage.getItem('bestDayCrops');
    if (saved) return JSON.parse(saved);
    const single = localStorage.getItem('selectedCrop');
    return single ? [single] : ['Tomato'];
  });

  // Jab bhi crop badle, uska current price fetch karo
  useEffect(() => {
    setCurrentPrice(0); setPriceRange(null);
    fetch(`${BASE_URL}/api/history?commodity=${encodeURIComponent(selectedCrop)}&market=Azadpur%20APMC`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : { data: [] })
      .then((res: any) => {
        const arr = Array.isArray(res) ? res : (res?.data ?? []);
        if (arr.length) {
          setCurrentPrice(Math.round(arr[arr.length - 1].modal_price));
          const prices = arr.map((r: any) => r.modal_price);
          setPriceRange({ min: Math.round(Math.min(...prices)), max: Math.round(Math.max(...prices)) });
        }
      })
      .catch(() => {});
  }, [selectedCrop]);

  useEffect(() => {
    loadAlerts();
    // Profile se crops fetch karo
    const token = localStorage.getItem('mandiq_token');
    if (!token) return;
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        const crops: string[] = u?.farmer_details?.crops;
        if (Array.isArray(crops) && crops.length > 0) {
          setUserCrops(crops);
          localStorage.setItem('bestDayCrops', JSON.stringify(crops));
        }
      })
      .catch(() => {});
  }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/alerts`, { headers: authHeaders() });
      if (r.ok) {
        setAlerts(await r.json());
      } else {
        console.error("GET active alerts failed:", r.status);
      }
    } catch (err) {
      console.error("GET active alerts exception:", err);
    }
    setLoading(false);

    setNotifLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/alerts?triggered=1`, { headers: authHeaders() });
      if (r.ok) {
        setNotifications(await r.json());
      } else {
        console.error("GET triggered alerts failed:", r.status);
      }
    } catch (err) {
      console.error("GET triggered alerts exception:", err);
    }
    setNotifLoading(false);
  }

  /** Push permission maango — alert banane se PEHLE, taaki instant
   *  trigger hone par notification miss na ho. */
  async function ensurePushPermission() {
    try {
      const OneSignal = (window as any).OneSignal;
      if (OneSignal?.Notifications) {
        if (!OneSignal.Notifications.permission) {
          await OneSignal.Notifications.requestPermission();
        }
        setNotifDenied(!OneSignal.Notifications.permission);
        return;
      }
      if ('Notification' in window) {
        const res = await Notification.requestPermission();
        setNotifDenied(res !== 'granted');
      }
    } catch {}
  }

  async function createAlert() {
    const p = parseFloat(tp);
    if (!p || p <= 0) return;
    if (priceRange && (p < priceRange.min || p > priceRange.max)) return;
    setSaving(true);
    await ensurePushPermission();
    try {
      const r = await fetch(`${BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ crop: selectedCrop, market: 'Azadpur APMC', target_price: p, direction }),
      });
      if (r.ok) {
        setTp('');
        setAdded(true);
        setTimeout(() => setAdded(false), 2500);
        await loadAlerts();
        // APK mein confirmation notification
        showLocalNotification('✅ अलर्ट सेट हो गया', `${selectedCrop} ₹${p} ${direction === 'above' ? 'से ऊपर' : 'से नीचे'} जाने पर सूचना मिलेगी`).catch(() => {});
      }
    } catch {}
    setSaving(false);
  }

  async function deleteAlert(id: number) {
    try {
      await fetch(`${BASE_URL}/api/alerts/${id}`, { method: 'DELETE', headers: authHeaders() });
      setAlerts(prev => prev.filter(a => a.id !== id));
      setNotifications(prev => prev.filter(a => a.id !== id));
    } catch {}
  }

  const CROPS = [
    { name: 'Tomato', emoji: '🍅' },
    { name: 'Potato', emoji: '🥔' },
    { name: 'Onion', emoji: '🧅' },
    { name: 'Spinach', emoji: '🌿' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto mq-fadein">
      {/* Header */}
      <div className="mq-header px-6 pt-10 pb-6 rounded-b-[2.5rem]">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/home')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('alerts.title')}</h2>
            <p className="text-white/70 text-xs">{t('alerts.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* How it works */}
        <div className="bg-[#e8f5e9] rounded-2xl p-4 border border-[#2d6a3e]/20">
          <p className="text-xs font-semibold text-[#2d6a3e] mb-2">🔔 {t('alerts.howItWorks')}</p>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-600">1️⃣ {t('alerts.step1')}</p>
            <p className="text-xs text-gray-600">2️⃣ {t('alerts.step2')}</p>
            <p className="text-xs text-gray-600">3️⃣ {t('alerts.step3')}</p>
          </div>
        </div>

        {/* Create Alert */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-[#e8f5e9] rounded-2xl flex items-center justify-center">
              <Target className="w-5 h-5 text-[#2d6a3e]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">{t('alerts.targetTitle')}</p>
              <p className="text-xs text-gray-400">{t('alerts.targetDesc')}</p>
            </div>
          </div>

          {/* Crop */}
          <p className="text-xs text-gray-400 mb-2">{t('alerts.selectCrop')}</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {CROPS.map(c => (
              <button key={c.name} onClick={() => setSelectedCrop(c.name)}
                className={`flex flex-col items-center py-2.5 px-1 rounded-2xl border-2 transition-all ${selectedCrop === c.name ? 'bg-[#2d6a3e] border-[#2d6a3e]' : 'bg-gray-50 border-gray-100'}`}>
                <span className="text-xl mb-1">{c.emoji}</span>
                <p className={`text-xs font-medium leading-tight text-center ${selectedCrop === c.name ? 'text-white' : 'text-gray-600'}`}>{cropName(c.name, t)}</p>
              </button>
            ))}
          </div>

          {/* Direction */}
          <p className="text-xs text-gray-400 mb-2">{t('alerts.direction')}</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setDirection('above')}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${direction === 'above' ? 'bg-[#2d6a3e] border-[#2d6a3e] text-white' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
              {t('alerts.above')}
            </button>
            <button onClick={() => setDirection('below')}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${direction === 'below' ? 'bg-[#c9183a] border-[#c9183a] text-white' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
              {t('alerts.below')}
            </button>
          </div>

          {/* Price Input — historical range se validate */}
          {priceRange && (
            <div className="flex items-center gap-2 bg-[#e8f5e9] border border-[#2d6a3e]/20 rounded-xl px-3 py-2 mb-3">
              <span className="text-sm">📊</span>
              <p className="text-xs font-bold text-[#2d6a3e]">
                {t('alerts.validRange').replace('{min}', String(priceRange.min)).replace('{max}', String(priceRange.max))}
              </p>
            </div>
          )}
          {(() => {
            const p = parseFloat(tp);
            const outOfRange = priceRange && tp !== '' && p > 0 && (p < priceRange.min || p > priceRange.max);
            const canSet = tp && p > 0 && !outOfRange;
            return (
              <>
                <div className="flex gap-2 mb-1">
                  <div className={`flex-1 flex items-center bg-gray-50 rounded-2xl px-4 border-2 transition-colors ${outOfRange ? 'border-red-400' : 'border-gray-100 focus-within:border-[#2d6a3e]'}`}>
                    <span className="text-gray-400 font-semibold mr-2">₹</span>
                    <input
                      type="number"
                      placeholder={t('alerts.pricePh')}
                      value={tp}
                      onChange={e => setTp(e.target.value)}
                      className="flex-1 py-3 bg-transparent outline-none text-sm text-gray-800"
                    />
                  </div>
                  <button onClick={createAlert} disabled={!canSet || saving}
                    className={`px-4 py-3 rounded-2xl font-semibold text-sm transition-all ${canSet ? 'bg-[#2d6a3e] text-white active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('alerts.setBtn')}
                  </button>
                </div>
                {outOfRange && priceRange && (
                  <p className="text-xs text-red-500 mb-2">
                    ⚠️ {t('alerts.validRange').replace('{min}', String(priceRange.min)).replace('{max}', String(priceRange.max))}
                  </p>
                )}
              </>
            );
          })()}

          {added && (
            <div className="flex items-center gap-2 bg-green-50 rounded-xl px-4 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs text-green-700 font-medium">{t('alerts.setDone')}</p>
            </div>
          )}
        </div>

        {/* Best Day Alert — with toggle */}
        <div className="bg-gradient-to-br from-[#fff7ed] to-white rounded-3xl p-5 border border-[#f97316]/20 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-[#fff7ed] rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#f97316]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{t('alerts.bestDayTitle')}</p>
              <p className={`text-xs font-medium ${bestDay ? 'text-[#f97316]' : 'text-gray-400'}`}>
                {bestDay ? t('alerts.bestDayOn') : t('alerts.bestDayOff')}
              </p>
            </div>
            <button
              onClick={async () => {
                if (bestDay) {
                  // Toggle OFF — backend se best_day alerts delete karo
                  setBestDay(false);
                  localStorage.setItem('bestDayAlert', 'off');
                  setNotifDenied(false);
                  fetch(`${BASE_URL}/api/alerts/best-day/off`, { method: 'DELETE', headers: authHeaders() }).catch(() => {});
                } else {
                  // Permission maango
                  await ensurePushPermission();
                  if (notifDenied) return;
                  // Backend pe crops ke liye best_day alerts banao
                  try {
                    await fetch(`${BASE_URL}/api/alerts/best-day/on`, {
                      method: 'POST',
                      headers: authHeaders(),
                      body: JSON.stringify({ crops: userCrops, market: selectedMarket || 'Azadpur APMC' }),
                    });
                  } catch {}
                  setBestDay(true);
                  localStorage.setItem('bestDayAlert', 'on');
                }
              }}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${bestDay ? 'bg-[#f97316]' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${bestDay ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          {/* User ke crops — jinke liye best day alert jayegi */}
          <p className="text-xs text-gray-500 mt-2">{t('alerts.bestDayForCrops')}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {userCrops.map(c => (
              <span key={c} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fff7ed] text-[#c2410c] border border-[#f97316]/20">
                <span>{CROP_ICONS[c] || '🌱'}</span>
                <span>{cropName(c, t)}</span>
              </span>
            ))}
          </div>

          {notifDenied && (
            <p className="text-xs text-red-500 mt-2">⚠️ {t('alerts.notifDenied')}</p>
          )}
        </div>

        {/* My Alerts */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#2d6a3e]" />
            <p className="font-semibold text-gray-800">{t('alerts.myAlerts')}</p>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-[#2d6a3e]" />
            </div>
          )}

          {!loading && alerts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">{t('common.noData')}</p>
          )}

          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-[#f0fdf4] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CROP_ICONS[a.crop] || '🌱'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{cropName(a.crop, t)}</p>
                    <p className="text-xs text-gray-500">
                      {t('alerts.whenReaches')}{' '}
                      <span className={`font-bold ${a.direction === 'above' ? 'text-green-600' : 'text-red-500'}`}>
                        {a.direction === 'above' ? '≥' : '≤'} ₹{a.target_price}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">{a.market}</p>
                  </div>
                </div>
                <button onClick={() => deleteAlert(a.id)}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Triggered Alerts History (Notifications) */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-[#2d6a3e]" />
            <p className="font-semibold text-gray-800">{t('alerts.historyTitle')}</p>
          </div>

          {notifLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-[#2d6a3e]" />
            </div>
          )}

          {!notifLoading && notifications.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">{t('alerts.noHistory')}</p>
          )}

          <div className="space-y-3">
            {notifications.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CROP_ICONS[a.crop] || '🌱'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{cropName(a.crop, t)}</p>
                    <p className="text-xs text-gray-500">
                      Target crossed: <span className="font-bold text-gray-700">₹{a.target_price}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">Triggered: {a.triggered_at ? new Date(a.triggered_at).toLocaleString('en-IN') : ''}</p>
                  </div>
                </div>
                <button onClick={() => deleteAlert(a.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
      <SupportChat />
    </div>
  );
}
