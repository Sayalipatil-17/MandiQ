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

export function MandiCompareScreen() {
  const nav = useNavigate();
  const { t } = useT();
  const crop = localStorage.getItem('selectedCrop') || 'Tomato';
  const [ld, setLd] = useState(true);
  const [mandis, setMandis] = useState<any[]>([]);

  useEffect(() => {
    let c = false;
    async function load() {
      setLd(true);
      const r = await Promise.all(MM.map(async m => {
        let price = 0, prevPrice = 0;
        try {
          const h = await mandiApi.getHistory(crop, m.value);
          if (h.length) {
            price = Math.round(h[h.length - 1].modal_price);
            prevPrice = h.length > 1 ? Math.round(h[h.length - 2].modal_price) : price;
          }
        } catch {}
        const change = price - prevPrice;
        const netProfit = price > 0 ? price - m.transportCost : 0;
        return { ...m, price, change, netProfit };
      }));
      const withPrice = r.filter(x => x.price > 0);
      const bestValue = withPrice.length ? withPrice.reduce((a, b) => b.netProfit > a.netProfit ? b : a).value : null;
      if (!c) { setMandis(r.map(x => ({ ...x, isBest: x.value === bestValue }))); setLd(false); }
    }
    load();
    return () => { c = true; };
  }, [crop]);

  const bestMandi = mandis.find(m => m.isBest);

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto">
      <div className="bg-gradient-to-br from-[#1e5631] via-[#2d6a3e] to-[#16a34a] px-6 pt-8 pb-6 rounded-b-[2rem] shadow-lg">
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
            <p className="text-2xl font-bold">{bestMandi.emoji} {bestMandi.value}</p>
          </div>
        )}

        {!ld && mandis.map(m => {
          const up = m.change > 0, down = m.change < 0;
          return (
            <div key={m.value} className={`bg-white rounded-3xl p-5 shadow-sm border-2 ${m.isBest ? 'border-[#f97316]' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl">{m.emoji}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800">{m.value}</p>
                    {m.isBest && <span className="px-2 py-0.5 bg-[#f97316] text-white text-xs rounded-full flex items-center gap-1"><Star className="w-3 h-3 fill-white" /> Best</span>}
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
