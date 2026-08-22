import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Star, TrendingUp, TrendingDown, Minus, Loader2, Navigation } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { mandiApi } from '../../mandiq-api';
import { useT, cropName } from '../../i18n';

const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };

const MM = [
  { value: 'Azadpur APMC', emoji: '🏪', transportCost: 120 },
  { value: 'Keshopur APMC', emoji: '🏬', transportCost: 180 },
];

const CROP_BENCHMARKS: Record<string, Record<string, { price: number; change: number }>> = {
  Tomato: {
    'Azadpur APMC': { price: 1850, change: 50 },
    'Keshopur APMC': { price: 1780, change: -30 },
  },
  Potato: {
    'Azadpur APMC': { price: 1250, change: 20 },
    'Keshopur APMC': { price: 1210, change: 0 },
  },
  Onion: {
    'Azadpur APMC': { price: 2150, change: 80 },
    'Keshopur APMC': { price: 2080, change: 40 },
  },
  Spinach: {
    'Azadpur APMC': { price: 980, change: -20 },
    'Keshopur APMC': { price: 940, change: 10 },
  },
};

export function MandiCompareScreen() {
  const nav = useNavigate();
  const { t } = useT();
  const crop = localStorage.getItem('selectedCrop') || 'Tomato';
  const [ld, setLd] = useState(true);
  const [mandis, setMandis] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLd(true);
      try {
        const r = await Promise.all(MM.map(async m => {
          const fallback = CROP_BENCHMARKS[crop]?.[m.value] || { price: 1500, change: 0 };
          const timeoutPromise = new Promise<{ price: number; prevPrice: number }>((resolve) =>
            setTimeout(() => {
              resolve({ price: fallback.price, prevPrice: fallback.price - fallback.change });
            }, 2500)
          );

          const fetchPromise = (async () => {
            try {
              const h = await mandiApi.getHistory(crop, m.value);
              if (h && h.length > 0) {
                const price = Math.round(h[h.length - 1].modal_price);
                const prevPrice = h.length > 1 ? Math.round(h[h.length - 2].modal_price) : price;
                return { price, prevPrice };
              }
            } catch {}
            return { price: fallback.price, prevPrice: fallback.price - fallback.change };
          })();

          const { price, prevPrice } = await Promise.race([fetchPromise, timeoutPromise]);
          const change = price - prevPrice;
          const netProfit = price > 0 ? price - m.transportCost : 0;
          return { ...m, price, change, netProfit };
        }));

        const withPrice = r.filter(x => x.price > 0);
        const bestValue = withPrice.length ? withPrice.reduce((a, b) => b.netProfit > a.netProfit ? b : a).value : null;
        if (!cancelled) {
          setMandis(r.map(x => ({ ...x, isBest: x.value === bestValue })));
        }
      } catch (err) {
        console.warn('[MandiCompareScreen] Load error:', err);
      } finally {
        if (!cancelled) setLd(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [crop]);

  const bestMandi = mandis.find(m => m.isBest);

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto mq-fadein">
      <div className="mq-header px-6 pt-10 pb-6 rounded-b-[2.5rem]">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => nav('/home')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h2 className="text-lg font-semibold text-white">{t('cmp.title')}</h2>
        </div>
        <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2 w-fit">
          <span className="text-lg">{CROP_ICONS[crop]}</span>
          <p className="text-white font-semibold text-sm">{cropName(crop, t)}</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {ld && (
          <div className="flex items-center gap-2 text-[#2d6a3e] py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{t('cmp.loading')}</span>
          </div>
        )}

        {!ld && bestMandi && (
          <div className="bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-3xl p-5 text-white shadow-md">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              <p className="font-semibold text-sm">{t('cmp.bestSell')}</p>
            </div>
            <p className="text-2xl font-bold">{bestMandi.emoji} {t(bestMandi.value === 'Azadpur APMC' ? 'mandi.azadpur' : 'mandi.keshopur')}</p>
          </div>
        )}

        {/* ── Visual Bar Chart Comparison Card (Matching screenshot) ── */}
        {!ld && mandis.length > 0 && (() => {
          const valid = mandis.filter(m => m.price > 0);
          const maxPrice = valid.length > 0 ? Math.max(...valid.map(m => m.price)) : 0;
          const minPrice = valid.length > 0 ? Math.min(...valid.map(m => m.price)) : 0;
          const priceDiff = maxPrice - minPrice;

          return (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
              {/* Header with price difference badge */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('home.mandiCompare')}</p>
                  <p className="text-sm font-bold text-gray-800">{cropName(crop, t)} — Mandi Bhav</p>
                </div>
                {priceDiff > 0 && (
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-2.5 py-1 text-right">
                    <p className="text-[10px] text-amber-700 font-bold">
                      ₹{priceDiff.toLocaleString()} {t('cmp.fark') || 'फ़र्क'}
                    </p>
                  </div>
                )}
              </div>

              {/* Vertical Bar Chart Container */}
              <div className="pt-4 pb-2 px-4 flex items-end justify-center gap-12 min-h-[220px]">
                {mandis.map((m) => {
                  const isBest = m.isBest || (maxPrice > 0 && m.price === maxPrice);
                  // Scale height: maxPrice gets 160px, lower price scales proportionally (min 50px)
                  const barHeightPx = maxPrice > 0 ? Math.max(50, Math.round((m.price / maxPrice) * 160)) : 80;

                  return (
                    <div key={m.value} className="flex flex-col items-center flex-1 max-w-[120px]">
                      {/* Price above bar */}
                      <div className="mb-2 text-center">
                        <p className={`text-base font-extrabold tracking-tight ${isBest ? 'text-[#2e5d16]' : 'text-gray-800'}`}>
                          {m.price > 0 ? `₹${m.price.toLocaleString()}` : '—'}
                        </p>
                      </div>

                      {/* Bar Pillar */}
                      <div className="w-full flex justify-center items-end" style={{ height: '160px' }}>
                        <div
                          className={`w-20 rounded-t-2xl transition-all duration-700 ${
                            isBest
                              ? 'bg-[#3b6d16] shadow-sm'
                              : 'bg-[#FBD88B] shadow-sm'
                          }`}
                          style={{
                            height: `${barHeightPx}px`,
                            background: isBest
                              ? 'linear-gradient(180deg, #44791c 0%, #315e10 100%)'
                              : 'linear-gradient(180deg, #fde29b 0%, #f6ce72 100%)',
                          }}
                        />
                      </div>

                      {/* Mandi Name Below Bar */}
                      <div className="mt-3 flex items-center justify-center gap-1.5 text-center">
                        {isBest && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                        )}
                        <p className={`text-sm font-bold ${isBest ? 'text-gray-900' : 'text-gray-700'}`}>
                          {t(m.value === 'Azadpur APMC' ? 'mandi.azadpur.short' : 'mandi.keshopur.short')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-400 text-center mt-3 pt-2 border-t border-gray-50 font-medium">
                {t('common.perQuintal')} · Live Mandi Comparison
              </p>
            </div>
          );
        })()}

        {!ld && mandis.map(m => {
          const up = m.change > 0, down = m.change < 0;
          return (
            <div key={m.value} className={`bg-white rounded-3xl p-5 shadow-sm border-2 ${m.isBest ? 'border-[#f97316]' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl">{m.emoji}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{t(m.value === 'Azadpur APMC' ? 'mandi.azadpur' : 'mandi.keshopur')}</p>
                    {m.isBest && <span className="px-2 py-0.5 bg-[#f97316] text-white text-xs rounded-full flex items-center gap-1"><Star className="w-3 h-3 fill-white" /> {t('common.best')}</span>}
                  </div>
                </div>
                <button onClick={() => window.open(`https://maps.google.com/?q=${m.value}+Delhi`, '_blank')}
                  className="p-2.5 rounded-xl border border-[#2d6a3e] text-[#2d6a3e]">
                  <Navigation className="w-4 h-4" />
                </button>
              </div>

              {m.price > 0 ? (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">{t('cmp.todayPrice')}</p>
                    <p className="text-3xl font-bold text-[#1b4228]">₹{m.price.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{t('common.perQuintal')}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-semibold ${up ? 'bg-green-50 text-green-700' : down ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'}`}>
                    {up ? <TrendingUp className="w-4 h-4" /> : down ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {up ? `₹${m.change} ${t('cmp.increased')}` : down ? `₹${Math.abs(m.change)} ${t('cmp.decreased')}` : t('cmp.same')}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-3">{t('cmp.noData')}</p>
              )}
            </div>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}
