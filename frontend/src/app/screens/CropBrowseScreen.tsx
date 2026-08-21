import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, ArrowLeft, Leaf, Apple, Wheat, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Input } from '../components/ui/input';
import { mandiApi } from '../../mandiq-api';
import { useT } from '../../i18n';

const CROP_ICONS: Record<string, string> = {
  Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿',
  Cauliflower: '🥦', Mango: '🥭', Apple: '🍎', Wheat: '🌾', Rice: '🌾',
};

const categories = [
  { id: 'all', icon: Leaf, labelKey: 'crops.category.all' },
  { id: 'vegetables', icon: Leaf, labelKey: 'crops.category.vegetables' },
  { id: 'fruits', icon: Apple, labelKey: 'crops.category.fruits' },
  { id: 'grains', icon: Wheat, labelKey: 'crops.category.grains' },
];

const CROPS = [
  { name: 'Tomato', nameHindi: 'टमाटर', category: 'vegetables', seasonal: true, shelfLife: '5-7 days' },
  { name: 'Potato', nameHindi: 'आलू', category: 'vegetables', seasonal: false, shelfLife: '15-20 days' },
  { name: 'Onion', nameHindi: 'प्याज', category: 'vegetables', seasonal: false, shelfLife: '20-30 days' },
  { name: 'Spinach', nameHindi: 'पालक', category: 'vegetables', seasonal: true, shelfLife: '2-4 days' },
  { name: 'Cauliflower', nameHindi: 'फूलगोभी', category: 'vegetables', seasonal: true, shelfLife: '7-10 days' },
  { name: 'Mango', nameHindi: 'आम', category: 'fruits', seasonal: true, shelfLife: '3-5 days' },
  { name: 'Apple', nameHindi: 'सेब', category: 'fruits', seasonal: false, shelfLife: '15-30 days' },
  { name: 'Wheat', nameHindi: 'गेहूँ', category: 'grains', seasonal: false, shelfLife: '6-12 months' },
  { name: 'Rice', nameHindi: 'चावल', category: 'grains', seasonal: false, shelfLife: '6-12 months' },
];

type CR = (typeof CROPS)[number] & { currentPrice: number | null; trend: 'up' | 'down' | 'stable'; available: boolean };

export function CropBrowseScreen() {
  const nav = useNavigate(); const { t, lang } = useT();
  const [sq, setSq] = useState('');
  const [sc, setSc] = useState('all');
  const [sel, setSel] = useState<string | null>(null);
  const [rows, setRows] = useState<CR[]>([]);
  const mkt = localStorage.getItem('selectedMarket') || 'Azadpur APMC';

  useEffect(() => {
    let c = false;
    async function l() {
      let av = new Set<string>();
      try { (await mandiApi.listCommodities()).forEach(x => av.add(x.commodity)); } catch {}
      const r: CR[] = await Promise.all(CROPS.map(async cr => {
        if (!av.has(cr.name)) return { ...cr, currentPrice: null, trend: 'stable' as const, available: false };
        try {
          const h = await mandiApi.getHistory(cr.name, mkt);
          if (!h.length) return { ...cr, currentPrice: null, trend: 'stable' as const, available: false };
          const l = Math.round(h[h.length - 1].modal_price), p = h.length > 1 ? Math.round(h[h.length - 2].modal_price) : l;
          return { ...cr, currentPrice: l, trend: l > p ? 'up' : l < p ? 'down' : 'stable', available: true };
        } catch { return { ...cr, currentPrice: null, trend: 'stable' as const, available: false }; }
      }));
      if (!c) setRows(r);
    }
    l(); return () => { c = true; };
  }, [mkt]);

  const fc = rows.filter(c => {
    const ms = c.name.toLowerCase().includes(sq.toLowerCase()) || c.nameHindi.includes(sq);
    const mc = sc === 'all' || c.category === sc;
    return ms && mc;
  });

  const hs = (n: string, a: boolean) => {
    if (!a) return;
    localStorage.setItem('selectedCrop', n); setSel(n);
    setTimeout(() => nav('/home'), 300);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 pb-4 sticky top-0 z-10 shadow-sm" style={{ paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 0.75rem), 2.25rem)' }}>
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => nav('/home')} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-[#2d6a3e]" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('home.selectCrop')}</h2>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input type="text" placeholder={t('common.search') + '...'} value={sq} onChange={e => setSq(e.target.value)}
            className="pl-11 h-11 rounded-2xl bg-gray-50 border-0 text-sm focus:ring-2 focus:ring-[#2d6a3e]/20" />
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          {categories.map(cat => {
            const I = cat.icon;
            return (
              <button key={cat.id} onClick={() => setSc(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${sc === cat.id ? 'bg-[#2d6a3e] text-white shadow-md shadow-[#2d6a3e]/20' : 'bg-white text-gray-600 border border-gray-200'}`}>
                <I className="w-3.5 h-3.5" />
                {t(cat.labelKey)}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">{t('crops.availableCount').replace('{count}', fc.filter(c => c.available).length.toString())}</p>

        <div className="space-y-3">
          {fc.map(crop => (
            <button key={crop.name} onClick={() => hs(crop.name, crop.available)} disabled={!crop.available}
              className={`w-full bg-white rounded-2xl border-2 transition-all text-left overflow-hidden ${sel === crop.name ? 'border-[#2d6a3e] shadow-lg shadow-[#2d6a3e]/10' : crop.available ? 'border-gray-100 hover:border-[#2d6a3e]/30 hover:shadow-md' : 'border-gray-100 opacity-60'}`}>
              <div className="p-4 flex items-center gap-4">
                {/* Crop Icon */}
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 ${crop.available ? 'bg-[#f0fdf4]' : 'bg-gray-50'}`}>
                  {CROP_ICONS[crop.name] || '🌱'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-800">{t(`crops.${crop.name.toLowerCase()}`)}</p>
                    {crop.seasonal && <span className="px-2 py-0.5 bg-[#fff7ed] text-[#f97316] text-xs rounded-full font-medium">{t('crops.seasonal')}</span>}
                  </div>
                  {lang !== 'en' && <p className="text-sm text-gray-400 mb-1.5">{crop.name}</p>}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t(`crops.shelflife.${crop.name.toLowerCase()}`)}</span>
                    {crop.available && crop.currentPrice !== null && (
                      <span className="text-[#2d6a3e] font-semibold">₹{crop.currentPrice}/{t('common.perQuintal')}</span>
                    )}
                  </div>
                </div>

                {/* Trend Badge */}
                <div className="flex-shrink-0">
                  {crop.available ? (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${crop.trend === 'up' ? 'bg-green-50' : crop.trend === 'down' ? 'bg-red-50' : 'bg-gray-50'}`}>
                      {crop.trend === 'up' ? <TrendingUp className="w-5 h-5 text-green-600" /> :
                        crop.trend === 'down' ? <TrendingDown className="w-5 h-5 text-red-500" /> :
                          <Minus className="w-5 h-5 text-gray-400" />}
                    </div>
                  ) : (
                    <span className="px-2.5 py-1 bg-[#fff7ed] text-[#f97316] text-xs rounded-xl font-medium">{t('crops.soon')}</span>
                  )}
                </div>
              </div>

              {/* Selected indicator bar */}
              {sel === crop.name && <div className="h-1 bg-[#2d6a3e] w-full" />}
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
