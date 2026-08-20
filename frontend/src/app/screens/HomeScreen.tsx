import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, TrendingUp, TrendingDown, Info, Bell, Sparkles, BarChart3, Building2, Loader2, Check, Search, Star, Minus, ChevronUp, Navigation, MapPin } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { SupportChat } from '../components/SupportChat';
import { SkeletonPriceCard, SkeletonAdviceCard } from '../components/Skeleton';
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { mandiApi, type Prediction, type PriceRecord } from '../../mandiq-api';
import { useT, cropName } from '../../i18n';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const MARKETS = [
  { value: 'Azadpur APMC', label: 'Azadpur Mandi', sublabel: 'Delhi (North)', emoji: '🏪', km: '12 km' },
  { value: 'Keshopur APMC', label: 'Keshopur Mandi', sublabel: 'Delhi (West)', emoji: '🏬', km: '18 km' },
];

const CROPS = [
  { name: 'Tomato', emoji: '🍅' },
  { name: 'Potato', emoji: '🥔' },
  { name: 'Onion', emoji: '🧅' },
  { name: 'Spinach', emoji: '🌿' },
];

const MANDI_MAP: Record<string, { labelKey: string; sublabelKey: string }> = {
  'Azadpur APMC': { labelKey: 'mandi.azadpur', sublabelKey: 'mandi.azadpur.desc' },
  'Keshopur APMC': { labelKey: 'mandi.keshopur', sublabelKey: 'mandi.keshopur.desc' },
};

function weekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Local date → "YYYY-MM-DD" (toISOString use mat karo — wo UTC shift kar deta hai) */
function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAYS_BEFORE = 0;
const DAYS_AFTER = 7;

interface DayEntry {
  dateKey: string;
  label: string;
  price: number;
  lower: number;
  upper: number;
  isActual: boolean;
}

/**
 * 7-din ki window: aaj se 3 din pehle → aaj → 3 din baad.
 * Har din ke liye: actual price agar scrape ho chuki hai, warna model ki prediction.
 * Jaise-jaise scraper naya data laata hai, purane din apne aap predicted se actual ban jaate hain.
 */
function buildDayStrip(
  history: PriceRecord[],
  predictions: Prediction[],
  todayLabel: string,
): { strip: DayEntry[]; todayIdx: number } {
  const actualMap = new Map<string, number>();
  history.forEach(h => {
    const key = (h.date || '').split('T')[0];
    if (key) actualMap.set(key, Math.round(h.modal_price));
  });

  const predMap = new Map<string, Prediction>();
  predictions.forEach(p => {
    const key = (p.date || '').split('T')[0];
    if (key) predMap.set(key, p);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const strip: DayEntry[] = [];
  let todayIdx = 0;

  for (let offset = -DAYS_BEFORE; offset <= DAYS_AFTER; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const key = dateKey(d);

    const actual = actualMap.get(key);
    const pred = predMap.get(key);

    let entry: DayEntry;
    if (actual !== undefined) {
      entry = {
        dateKey: key,
        label: offset === 0 ? todayLabel : weekday(key),
        price: actual,
        lower: Math.round(actual * 0.96),
        upper: Math.round(actual * 1.04),
        isActual: true,
      };
    } else if (pred) {
      entry = {
        dateKey: key,
        label: offset === 0 ? todayLabel : weekday(key),
        price: Math.round(pred.predicted_price),
        lower: Math.round(pred.lower_bound),
        upper: Math.round(pred.upper_bound),
        isActual: false,
      };
    } else {
      continue; // na actual na prediction → is din ko skip karo
    }

    if (offset === 0) todayIdx = strip.length;
    strip.push(entry);
  }

  return { strip, todayIdx };
}

function ChartSection({ forecastOnly, t }: { forecastOnly: { label: string; price: number }[]; t: (k: string) => string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <p className="font-semibold text-gray-800 text-sm">{t('home.showGraph')}</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${show ? 'bg-[#2d6a3e] text-white' : 'bg-[#e8f5e9] text-[#2d6a3e]'}`}>
          {show ? t('home.closeGraph') : t('home.viewGraph')}
        </span>
      </button>
      {show && (
        <div className="px-5 pb-5">
          <p className="text-xs text-gray-400 mb-3">{t('home.graphDesc')}</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={forecastOnly} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2d6a3e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2d6a3e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={48}
                domain={['dataMin - 50', 'dataMax + 50']} tickFormatter={v => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: '12px', padding: '6px 10px', fontSize: 12 }}
                formatter={(value: number) => [`₹${value}`, t('home.estimated')]} />
              <Area type="monotone" dataKey="price" stroke="#2d6a3e" strokeWidth={2.5}
                fill="url(#forecastGrad)" dot={{ fill: '#2d6a3e', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const { t, lang } = useT();

  useEffect(() => {
    const token = localStorage.getItem('mandiq_token');
    if (!token) return;
    fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setUserName(d.name || ''));

    fetch(`${BASE_URL}/api/alerts?triggered=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          setUnreadCount(d.length);
        }
      })
      .catch(() => {});
  }, []);

  const [selectedMarket, setSelectedMarket] = useState(localStorage.getItem('selectedMarket') || '');
  const [selectedCrop, setSelectedCrop] = useState(localStorage.getItem('selectedCrop') || '');
  const [showMandiDropdown, setShowMandiDropdown] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<Date | null>(null);
  const [history, setHistory] = useState<PriceRecord[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedDayIdx, setSelectedDayIdx] = useState(-1); // -1 = auto (aaj ka din)

  const selectedMandi = MARKETS.find(m => m.value === selectedMarket);
  const selectedCropObj = CROPS.find(c => c.name === selectedCrop);
  const canSearch = selectedMarket !== '' && selectedCrop !== '';

  async function loadCompare() {
    if (compareData.length) { setShowCompare(v => !v); return; }
    setShowCompare(true);
    setCompareLoading(true);
    const crop = selectedCrop || 'Tomato';
    const r = await Promise.all(MM.map(async m => {
      let price = 0, prevPrice = 0;
      try {
        const h = await mandiApi.getHistory(crop, m.value);
        if (h.length) { price = Math.round(h[h.length-1].modal_price); prevPrice = h.length > 1 ? Math.round(h[h.length-2].modal_price) : price; }
      } catch {}
      const change = price - prevPrice;
      const netProfit = price > 0 ? price - m.transportCost : 0;
      return { ...m, price, change, netProfit };
    }));
    const withPrice = r.filter(x => x.price > 0);
    const bestVal = withPrice.length ? withPrice.reduce((a, b) => b.netProfit > a.netProfit ? b : a).value : null;
    setCompareData(r.map(x => ({ ...x, isBest: x.value === bestVal })));
    setCompareLoading(false);
  }

  async function handleSearch() {
    if (!canSearch) return;
    setLoading(true); setError(null); setShowResult(false); setSelectedDayIdx(-1);
    try {
      const [hist, preds] = await Promise.all([
        mandiApi.getHistory(selectedCrop, selectedMarket),
        // 30 din maango — predictions last actual data ke agle din se start hoti hain,
        // isliye aaj ke aas-paas ki window cover karne ke liye buffer chahiye
        mandiApi.predict(selectedCrop, 30, selectedMarket),
      ]);
      setHistory(hist); setPredictions(preds); setShowResult(true); setSearchTime(new Date());
    } catch (e: any) {
      setError(e?.message || t('common.dataError'));
    } finally {
      setLoading(false);
    }
  }

  // Mount pe auto-load — agar farmer ne pehle mandi+crop select ki thi
  useEffect(() => {
    if (selectedMarket && selectedCrop) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 7-din ki strip: jahan scrape ho chuki wahan actual, warna prediction
  const { strip: dayStrip, todayIdx } = buildDayStrip(history, predictions, t('common.today'));

  // selectedDayIdx -1 hai to aaj ka din dikhao
  const activeIdx = selectedDayIdx >= 0 && selectedDayIdx < dayStrip.length ? selectedDayIdx : todayIdx;
  const selectedDay = dayStrip[activeIdx];
  const todayEntry = dayStrip[todayIdx];
  const todayPrice = todayEntry?.price ?? 0;

  const displayPrice = selectedDay?.price ?? todayPrice;
  const displayRange = selectedDay
    ? { low: selectedDay.lower, high: selectedDay.upper }
    : { low: Math.round(todayPrice * 0.96), high: Math.round(todayPrice * 1.04) };

  // Kal se aaj ka farak — strip ke pichhle din se compare karo
  const prevEntry = todayIdx > 0 ? dayStrip[todayIdx - 1] : null;
  const priceDiff = prevEntry ? todayPrice - prevEntry.price : 0;
  const yesterdayDateStr = prevEntry ? prevEntry.label : t('common.today');

  // AI weekly advice — aaj ke baad ke dino me best price kab hai
  let bestPrice = todayPrice, bestDay = '', bestIdx = -1;
  dayStrip.forEach((d, i) => {
    if (i <= todayIdx) return;
    if (d.price > bestPrice) { bestPrice = d.price; bestDay = d.label; bestIdx = i; }
  });
  const gain = Math.round(bestPrice - todayPrice);
  const holdDays = bestIdx >= 0 ? bestIdx - todayIdx : 0;
  const avgConf = predictions.length
    ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length) : 0;
  const shouldSell = gain <= 0;

  const forecastOnly = dayStrip.map(d => ({ label: d.label, price: d.price }));

  return (
    <div className="min-h-screen bg-[#F2F2EE] pb-20 max-w-md mx-auto">

      {/* ── HEADER ── */}
      <div className="mq-header px-6 pt-10 pb-8 rounded-b-[2.5rem]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/40">
              <img src="/farmer-avatar.svg" alt="kisan" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-white/70 text-xs">{t('home.namaste')}</p>
              <p className="text-white font-semibold">{userName || 'Namaste'}</p>
            </div>
          </div>
          <button onClick={() => navigate('/alerts')} className="relative p-2.5 bg-white/20 backdrop-blur rounded-xl border border-white/30">
            <Bell className="w-5 h-5 text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#E8692A] rounded-full text-white text-xs flex items-center justify-center font-bold">{unreadCount}</span>
            )}
          </button>
        </div>

        <p className="text-white text-lg font-semibold mb-5">{t('home.title')}</p>

        {/* ── Mandi select — side by side cards ── */}
        {/* Mandi dropdown */}
        <div className="mb-3 relative">
          <p className="text-white text-sm font-bold mb-2">{t('home.selectMandi')}</p>
          <button onClick={() => setShowMandiDropdown(!showMandiDropdown)}
            className="w-full bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3.5 flex items-center justify-between border border-white/20">
            {selectedMandi ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedMandi.emoji}</span>
                <div className="text-left">
                  <p className="text-white font-medium text-sm">
                    {MANDI_MAP[selectedMandi.value] ? t(MANDI_MAP[selectedMandi.value].labelKey) : selectedMandi.label}
                  </p>
                  <p className="text-white/60 text-xs">
                    {MANDI_MAP[selectedMandi.value] ? t(MANDI_MAP[selectedMandi.value].sublabelKey) : selectedMandi.sublabel}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-sm">{t('home.selectMandiPh')}</p>
            )}
            <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${showMandiDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showMandiDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              {MARKETS.map(mandi => (
                <button key={mandi.value}
                  onClick={() => { setSelectedMarket(mandi.value); localStorage.setItem('selectedMarket', mandi.value); setShowMandiDropdown(false); setShowResult(false); setCompareData([]); }}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${selectedMarket === mandi.value ? 'bg-[#E6F2EB]' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${selectedMarket === mandi.value ? 'bg-[#1C4230]/10' : 'bg-gray-100'}`}>{mandi.emoji}</div>
                  <div className="flex-1 text-left">
                    <p className={`font-medium text-sm ${selectedMarket === mandi.value ? 'text-[#1C4230]' : 'text-gray-800'}`}>
                      {MANDI_MAP[mandi.value] ? t(MANDI_MAP[mandi.value].labelKey) : mandi.label}
                    </p>
                    <p className="text-xs text-gray-400">
                      {MANDI_MAP[mandi.value] ? t(MANDI_MAP[mandi.value].sublabelKey) : mandi.sublabel}
                    </p>
                  </div>
                  {selectedMarket === mandi.value && <Check className="w-5 h-5 text-[#1C4230]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Crop grid */}
        <div>
          <p className="text-white text-sm font-bold mb-2">{t('home.selectCrop')}</p>
          <div className="grid grid-cols-4 gap-2">
            {CROPS.map(crop => {
              const isSelected = selectedCrop === crop.name;
              return (
                <button key={crop.name}
                  onClick={() => { setSelectedCrop(crop.name); localStorage.setItem('selectedCrop', crop.name); setShowResult(false); }}
                  className={`flex flex-col items-center py-3 px-1 rounded-2xl border-2 transition-all ${isSelected ? 'bg-white border-white' : 'bg-white/15 border-white/20'}`}>
                  <span className="text-2xl mb-1">{crop.emoji}</span>
                  <p className={`text-xs font-medium leading-tight text-center ${isSelected ? 'text-[#1C4230]' : 'text-white'}`}>{cropName(crop.name, t)}</p>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#1C4230] mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search button */}
        <button onClick={handleSearch} disabled={!canSearch || loading}
          className={`w-full mt-4 py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 ${canSearch ? 'mq-cta text-white' : 'bg-white/15 text-white/40 cursor-not-allowed opacity-60'}`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          {loading ? t('home.loading') : t('home.checkPrice')}
        </button>
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div className="px-5 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm text-red-700">{t('common.dataError')}</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── SKELETON LOADING ── */}
      {loading && (
        <div className="px-5 mt-4 space-y-4">
          <SkeletonPriceCard />
          <SkeletonAdviceCard />
        </div>
      )}

      {/* ── RESULTS ── */}
      {showResult && !loading && (
        <div className="px-5 mt-4 space-y-4 mq-slideup">



          {/* AAJ KI KIMAT */}
          <div className="mq-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="mq-live-dot" />
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{t('home.todayPrice')}</p>
                  {searchTime && (
                    <span className="text-xs text-gray-400 ml-1">
                      · {t('common.today')} {searchTime.toLocaleTimeString(lang === 'pa' ? 'pa-IN' : lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-800">
                  {selectedCropObj?.emoji} {cropName(selectedCrop, t)} · <span className="font-bold text-gray-800">
                    {selectedMandi && MANDI_MAP[selectedMandi.value] ? t(MANDI_MAP[selectedMandi.value].labelKey) : selectedMandi?.label}
                  </span>
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 font-semibold ${priceDiff >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {priceDiff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceDiff >= 0 ? '+' : ''}₹{Math.abs(priceDiff)} | {yesterdayDateStr}
              </div>
            </div>

            {/* Price + Range box */}
            <div className="bg-[#E6F2EB] rounded-2xl px-4 py-3 mb-4">
              <div className="flex items-baseline gap-2 mb-3">
                <p className="mq-price text-5xl text-[#122B1F] mq-count-up">₹{displayPrice.toLocaleString()}</p>
                <div className="flex flex-col gap-0.5">
                  <p className="text-gray-400 text-sm">{t('common.perQuintal')}</p>
                  {selectedDay && !selectedDay.isActual && (
                    <span className="text-xs text-[#E8692A] font-semibold">~ {t('home.estimated')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{t('common.min')}</p>
                  <p className="text-base font-semibold text-gray-700">₹{displayRange.low.toLocaleString()}</p>
                </div>
                <div className="w-px h-8 bg-gray-300" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">{t('common.max')}</p>
                  <p className="text-base font-semibold text-gray-700">₹{displayRange.high.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 7-day strip */}
            <p className="text-xs text-gray-400 mb-2">{t('home.selectDay')}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {dayStrip.map((day, idx) => {
                const isActive = activeIdx === idx;
                return (
                  <button key={day.dateKey} onClick={() => setSelectedDayIdx(idx)}
                    className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all min-w-[58px] ${isActive ? 'bg-[#1C4230] border-[#1C4230]' : idx === todayIdx ? 'bg-gray-50 border-[#1C4230]/30' : 'bg-gray-50 border-transparent'}`}>
                    <p className={`text-xs font-bold ${isActive ? 'text-white' : 'text-gray-600'}`}>{day.label}</p>
                    <p className={`text-xs mt-0.5 ${isActive ? 'text-white/80' : 'text-gray-400'}`}>₹{day.price.toLocaleString()}</p>
                    {!day.isActual && (
                      <span className={`text-[9px] mt-0.5 font-medium ${isActive ? 'text-white/60' : 'text-[#E8692A]'}`}>~{t('common.est')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MANDI COMPARE - bar chart visualization */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button onClick={loadCompare} className="w-full px-4 py-3.5 flex items-center gap-3 active:scale-95 transition-all">
              <div className="w-10 h-10 bg-[#E6F2EB] rounded-xl flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-[#1C4230]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-800">{t('home.mandiCompare')}</p>
                <p className="text-xs text-gray-400">{t('home.whichBest')}</p>
              </div>
              {showCompare ? <ChevronUp className="w-4 h-4 text-[#1C4230]" /> : <ChevronDown className="w-4 h-4 text-[#1C4230]" />}
            </button>

            {showCompare && (
              <div className="px-4 pb-4">
                {compareLoading && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-[#1C4230]" />
                  </div>
                )}

                {!compareLoading && compareData.length > 0 && (() => {
                  const valid = compareData.filter(m => m.price > 0);
                  const maxPrice = Math.max(...valid.map(m => m.price));
                  const minPrice = Math.min(...valid.map(m => m.price));
                  const priceDiff = maxPrice - minPrice;
                  const best = compareData.find(m => m.isBest);
                  const ranked = [...compareData].sort((a, b) => b.price - a.price);

                  return (
                    <>
                      {/* ── Title strip ── */}
                      <div className="flex items-center justify-between mb-4 pt-1">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{cropName(selectedCrop, t)} — Mandi Comparison</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">Price per quintal · Today</p>
                        </div>
                        {priceDiff > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5 text-right">
                            <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wide">Fark</p>
                            <p className="text-sm font-black text-amber-700">₹{priceDiff}</p>
                          </div>
                        )}
                      </div>

                      {/* ── Rank bars ── */}
                      <div className="space-y-3 mb-4">
                        {ranked.map((m, idx) => {
                          const pct = maxPrice > 0 ? Math.round((m.price / maxPrice) * 100) : 0;
                          const rankColor = idx === 0
                            ? { bg: '#E6F2EB', bar: 'linear-gradient(90deg,#1C4230,#3D8055)', text: '#1C4230', badge: '#1C4230' }
                            : idx === 1
                            ? { bg: '#F0F4FF', bar: 'linear-gradient(90deg,#4A6FA5,#6B8FC4)', text: '#2D4A7A', badge: '#4A6FA5' }
                            : { bg: '#FFF4F0', bar: 'linear-gradient(90deg,#C06A3C,#E8692A)', text: '#8B3A1A', badge: '#C06A3C' };
                          return (
                            <div key={m.value} className="rounded-2xl p-3.5" style={{ background: rankColor.bg }}>
                              {/* Rank badge + name + price */}
                              <div className="flex items-center gap-2.5 mb-2.5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                                  style={{ background: rankColor.badge }}>
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{m.emoji}</span>
                                    <p className="text-sm font-bold truncate" style={{ color: rankColor.text }}>
                                      {t(m.value === 'Azadpur APMC' ? 'mandi.azadpur.short' : 'mandi.keshopur.short')}
                                    </p>
                                    {idx === 0 && (
                                      <span className="text-[8px] font-black text-white px-1.5 py-0.5 rounded-full" style={{ background: rankColor.badge }}>
                                        {t('common.best')}
                                      </span>
                                    )}
                                  </div>
                                  {m.change !== 0 && m.price > 0 && (
                                    <p className={`text-[10px] font-semibold mt-0.5 ${m.change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      {m.change > 0 ? '▲' : '▼'} ₹{Math.abs(m.change)} {t('home.fromYesterday')}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-lg font-black" style={{ color: rankColor.text }}>
                                    {m.price > 0 ? `₹${m.price.toLocaleString()}` : '—'}
                                  </p>
                                  {idx > 0 && m.price > 0 && priceDiff > 0 && (
                                    <p className="text-[9px] text-red-400 font-semibold">{t('common.less').replace('{diff}', (maxPrice - m.price).toLocaleString())}</p>
                                  )}
                                </div>
                              </div>
                              {/* Progress bar with % label */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-3 bg-white/70 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${pct}%`, background: rankColor.bar }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold w-8 text-right" style={{ color: rankColor.text }}>{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>


                      {/* ── Best sell action card ── */}
                      {best && (
                        <div className="rounded-2xl p-4 flex items-center gap-3"
                          style={{ background: 'linear-gradient(135deg,#1C4230,#2D6644)', boxShadow: '0 4px 16px rgba(28,66,48,0.25)' }}>
                          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Star className="w-5 h-5 text-[#F5C842] fill-[#F5C842]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{t('home.bestSell')}</p>
                            <p className="text-sm font-bold text-white truncate">{t(best.value === 'Azadpur APMC' ? 'mandi.azadpur' : 'mandi.keshopur')}</p>
                            {priceDiff > 0 && (
                              <p className="text-[10px] text-[#7EFFA0] font-semibold">{t('home.moreThanOther').replace('{diff}', priceDiff.toLocaleString())}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xl font-black text-white">₹{best.price.toLocaleString()}</p>
                            <p className="text-[10px] text-white/60">{t('common.perQuintal')}</p>
                          </div>
                          <button onClick={() => window.open(`https://maps.google.com/?q=${best.value}+Delhi`, '_blank')}
                            className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0 active:scale-95">
                            <Navigation className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* AI ADVICE CARD */}
          {(() => {
            const reasons = shouldSell
              ? [
                  t('advice.r_sell1'),
                  priceDiff >= 0 ? t('advice.r_sell2up') : t('advice.r_sell2down'),
                  t('advice.r_sell3'),
                ]
              : [
                  t('advice.r_hold1'),
                  t('advice.r_hold2'),
                  t('advice.r_hold3'),
                ];

            return (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <p className="font-semibold text-gray-800 text-sm">{t('advice.label')}</p>
                  </div>
                  <button onClick={() => navigate('/prediction')} className="text-xs text-[#2d6a3e] flex items-center gap-1 font-medium">
                    {t('home.viewBtn')} <Info className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Verdict */}
                <p className="text-lg font-bold text-gray-900 mb-0.5">
                  {shouldSell ? t('advice.fallVerdict') : t('advice.riseVerdict')}
                </p>
                <p className="text-sm text-gray-400 mb-4">
                  {shouldSell
                    ? t('advice.fallSub')
                    : `${t('advice.riseSub')} ${holdDays}–${holdDays + 2} ${t('advice.riseDays')}`}
                </p>

                {/* Reasons */}
                <div className="space-y-2.5 mb-4">
                  {reasons.map((r, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-[#e8f5e9] flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-[#2d6a3e]" />
                      </div>
                      <p className="text-sm text-gray-600">{r}</p>
                    </div>
                  ))}
                </div>

                {/* Advice box */}
                <div className={`rounded-2xl px-4 py-3 flex items-start gap-2 ${shouldSell ? 'bg-red-50' : 'bg-[#fffbf0]'}`}>
                  <span className="text-base mt-0.5">{shouldSell ? '🔴' : '🟡'}</span>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <span className="font-semibold">{t('advice.salahLabel')} </span>
                    {shouldSell
                      ? t('advice.sellAdvice')
                      : `${t('advice.holdAdvice')} ${holdDays} ${t('advice.holdDays')}${gain.toLocaleString()} ${t('advice.holdMore')}`}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* CHART TOGGLE */}
          <ChartSection forecastOnly={forecastOnly} t={t} />

          {/* MANDI JANKARI + PAST TREND */}
          <div className="grid grid-cols-2 gap-3 mb-2 items-stretch">
            <button onClick={() => navigate('/mandi-info')}
              className="bg-[#fff7ed] rounded-2xl p-4 border border-[#f97316]/20 flex flex-col items-start justify-between h-full hover:border-[#f97316]/50 hover:shadow-sm transition-all active:scale-95">
              <div className="flex flex-col items-start gap-2 w-full">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <Building2 className="w-5 h-5 text-[#f97316]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 text-left leading-tight">{t('home.mandiInfo')}</p>
                  <p className="text-xs text-gray-400 text-left mt-0.5 leading-snug">{t('home.allPrices')}</p>
                </div>
              </div>
              <span className="text-xs text-[#f97316] font-semibold mt-3">{t('home.viewBtn')}</span>
            </button>

            <button onClick={() => navigate('/past-trend')}
              className="bg-[#f0f7f1] rounded-2xl p-4 border border-[#2d6a3e]/15 flex flex-col items-start justify-between h-full hover:border-[#2d6a3e]/40 hover:shadow-sm transition-all active:scale-95">
              <div className="flex flex-col items-start gap-2 w-full">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-[#2d6a3e]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 text-left leading-tight">{t('trend.title')}</p>
                  <p className="text-xs text-gray-400 text-left mt-0.5 leading-snug">{t('trend.priceHistory')}</p>
                </div>
              </div>
              <span className="text-xs text-[#2d6a3e] font-semibold mt-3">{t('home.viewBtn')}</span>
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      <SupportChat />
    </div>
  );
}
