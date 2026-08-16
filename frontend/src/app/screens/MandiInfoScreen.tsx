import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { mandiApi } from '../../mandiq-api';
import { useT, cropName } from '../../i18n';

const CROPS = [
  { name: 'Tomato', emoji: '🍅' },
  { name: 'Potato', emoji: '🥔' },
  { name: 'Onion', emoji: '🧅' },
  { name: 'Spinach', emoji: '🌿' },
];

const MARKETS = [
  { value: 'Azadpur APMC', label: 'Azadpur Mandi', emoji: '🏪' },
  { value: 'Keshopur APMC', label: 'Keshopur Mandi', emoji: '🏬' },
];

export function MandiInfoScreen() {
  const nav = useNavigate();
  const { t } = useT();
  const [selectedMarket, setSelectedMarket] = useState(localStorage.getItem('selectedMarket') || 'Azadpur APMC');
  const [ld, setLd] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let c = false;
    async function load() {
      setLd(true);
      const r = await Promise.all(CROPS.map(async cr => {
        try {
          const h = await mandiApi.getHistory(cr.name, selectedMarket);
          if (!h.length) return { ...cr, price: null, change: 0, trend: 'stable' };
          const price = Math.round(h[h.length - 1].modal_price);
          const prev = h.length > 1 ? Math.round(h[h.length - 2].modal_price) : price;
          const change = price - prev;
          return { ...cr, price, change, trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable' };
        } catch {
          return { ...cr, price: null, change: 0, trend: 'stable' };
        }
      }));
      if (!c) { setRows(r); setLd(false); }
    }
    load();
    return () => { c = true; };
  }, [selectedMarket]);

  const selectedMandiObj = MARKETS.find(m => m.value === selectedMarket) || MARKETS[0];

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto mq-fadein">
      {/* Header */}
      <div className="mq-header px-6 pt-10 pb-6 rounded-b-[2.5rem]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => nav('/home')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('info.title')}</h2>
            <p className="text-white/70 text-xs">{t('info.subtitle')}</p>
          </div>
        </div>

        {/* Mandi selector */}
        <p className="text-white/70 text-xs mb-2">{t('info.selectMandi')}</p>
        <div className="flex gap-2">
          {MARKETS.map(m => (
            <button key={m.value} onClick={() => { setSelectedMarket(m.value); localStorage.setItem('selectedMarket', m.value); }}
              className={`flex-1 py-2.5 px-2 rounded-2xl border-2 text-xs font-medium transition-all ${selectedMarket === m.value ? 'bg-white border-white text-[#2d6a3e]' : 'bg-white/15 border-white/20 text-white'}`}>
              {m.emoji} {m.label.replace(' Mandi', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        {ld && (
          <div className="flex items-center gap-2 text-[#2d6a3e] py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{t('info.loading')}</span>
          </div>
        )}

        {!ld && (
          <>
            <p className="text-sm text-gray-500 mb-3">{selectedMandiObj.emoji} {selectedMandiObj.label} — {t('info.todayPrices')}</p>
            <div className="space-y-3">
              {rows.map(c => (
                <div key={c.name} className="mq-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-[#f0fdf4] rounded-2xl flex items-center justify-center text-2xl">{c.emoji}</div>
                    <div>
                      <p className="font-semibold text-gray-800">{cropName(c.name, t)}</p>
                      <p className="text-xs text-gray-400">{c.name}</p>
                    </div>
                  </div>

                  {c.price !== null ? (
                    <div className="text-right">
                      <p className="text-xl font-bold text-[#1b4228]">₹{c.price.toLocaleString()}</p>
                      <div className={`flex items-center gap-1 justify-end text-xs font-semibold mt-0.5 ${c.trend === 'up' ? 'text-green-600' : c.trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
                        {c.trend === 'up' && <><TrendingUp className="w-3.5 h-3.5" /> +₹{c.change} {t('info.rising')}</>}
                        {c.trend === 'down' && <><TrendingDown className="w-3.5 h-3.5" /> ₹{Math.abs(c.change)} {t('info.falling')}</>}
                        {c.trend === 'stable' && <><Minus className="w-3.5 h-3.5" /> {t('info.stable')}</>}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-xl">{t('info.noData')}</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
