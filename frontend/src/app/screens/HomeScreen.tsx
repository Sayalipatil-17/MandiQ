import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, TrendingUp, TrendingDown, Info, Bell, Sparkles, BarChart3, Building2, Sprout, Loader2, Check, Search, Star, Minus, ChevronUp, Navigation } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { mandiApi, type Prediction, type PriceRecord } from '../../mandiq-api';
import { useT } from '../../i18n';
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const MARKETS = [
  { value: 'Azadpur APMC', label: 'Azadpur Mandi', sublabel: 'Delhi (North)', emoji: '🏪', km: '12 km' },
  { value: 'Keshopur APMC', label: 'Keshopur Mandi', sublabel: 'Delhi (West)', emoji: '🏬', km: '18 km' },
];

const CROPS = [
  { name: 'Tomato', hindi: 'टमाटर', emoji: '🍅' },
  { name: 'Potato', hindi: 'आलू', emoji: '🥔' },
  { name: 'Onion', hindi: 'प्याज', emoji: '🧅' },
  { name: 'Spinach', hindi: 'पालक', emoji: '🌿' },
];

const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };

function weekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function prettyDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function ChartSection({ forecastOnly }: { forecastOnly: { label: string; price: number }[] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setShow(!show)}
        className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <p className="font-semibold text-gray-800 text-sm">अगले 7 दिन का ग्राफ देखें</p>
        </div>
        <span className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${show ? 'bg-[#2d6a3e] text-white' : 'bg-[#e8f5e9] text-[#2d6a3e]'}`}>
          {show ? 'बंद करें ✕' : 'देखें →'}
        </span>
      </button>
      {show && (
        <div className="px-5 pb-5">
          <p className="text-xs text-gray-400 mb-3">कीमत बढ़ेगी या घटेगी — ग्राफ से समझें</p>
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
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={48} domain={['dataMin - 50', 'dataMax + 50']} tickFormatter={v => `₹${v}`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: '12px', padding: '6px 10px', fontSize: 12 }}
                formatter={(value: number) => [`₹${value}`, 'अनुमानित कीमत']} />
              <Area type="monotone" dataKey="price" stroke="#2d6a3e" strokeWidth={2.5} fill="url(#forecastGrad)" dot={{ fill: '#2d6a3e', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function HomeScreen() {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('mandiq_token');
    if (!token) return;
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => setUserName(d.name || ''));
  }, []);
    const navigate = useNavigate();
    const { t } = useT();

  // Selection state
  const [selectedMarket, setSelectedMarket] = useState(localStorage.getItem('selectedMarket') || '');
  const [selectedCrop, setSelectedCrop] = useState(localStorage.getItem('selectedCrop') || '');
  const [showMandiDropdown, setShowMandiDropdown] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareData, setCompareData] = useState<any[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const MM = [
    { value: 'Azadpur APMC', name: 'आज़ादपुर मंडी', emoji: '🏪', transportCost: 120 },
    { value: 'Keshopur APMC', name: 'केशोपुर मंडी', emoji: '🏬', transportCost: 180 },
  ];

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
    const bestVal = withPrice.length ? withPrice.reduce((a,b) => b.netProfit > a.netProfit ? b : a).value : null;
    setCompareData(r.map(x => ({ ...x, isBest: x.value === bestVal })));
    setCompareLoading(false);
  }

  // Data state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceRecord[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const selectedMandi = MARKETS.find(m => m.value === selectedMarket);
  const selectedCropObj = CROPS.find(c => c.name === selectedCrop);
  const canSearch = selectedMarket !== '' && selectedCrop !== '';

  async function handleSearch() {
    if (!canSearch) return;
    setLoading(true); setError(null); setShowResult(false); setSelectedDayIdx(0);
    try {
      const [hist, preds] = await Promise.all([
        mandiApi.getHistory(selectedCrop, selectedMarket),
        mandiApi.predict(selectedCrop, 7, selectedMarket),
      ]);
      setHistory(hist); setPredictions(preds); setShowResult(true);
    } catch (e: any) {
      setError(e?.message || t('common.dataError'));
    } finally {
      setLoading(false);
    }
  }

  // Price calculations
  const lastRecord = history.length ? history[history.length - 1] : null;
  const todayPrice = lastRecord ? Math.round(lastRecord.modal_price) : 0;
  const yesterdayRecord = history.length > 1 ? history[history.length - 2] : null;
  const yesterdayPrice = yesterdayRecord ? Math.round(yesterdayRecord.modal_price) : todayPrice;
  const yesterdayDateStr = yesterdayRecord
    ? new Date(yesterdayRecord.date).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })
    : 'कल';
  const priceDiff = todayPrice - yesterdayPrice;

  const selectedPred = selectedDayIdx > 0 && selectedDayIdx <= predictions.length
    ? predictions[selectedDayIdx - 1]
    : null;

  const displayPrice = selectedDayIdx === 0
    ? todayPrice
    : selectedPred
      ? Math.round(selectedPred.predicted_price)
      : todayPrice;

  // Today's range: based on last 7 days price volatility (std dev)
  const todayRange = (() => {
    const recent = history.slice(-7).map(h => h.modal_price);
    if (recent.length < 2) return { low: Math.round(todayPrice * 0.95), high: Math.round(todayPrice * 1.05) };
    const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
    const std = Math.sqrt(recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length);
    return { low: Math.round(todayPrice - std), high: Math.round(todayPrice + std) };
  })();

  const displayRange = selectedPred
    ? { low: Math.round(selectedPred.lower_bound), high: Math.round(selectedPred.upper_bound) }
    : todayRange;

  let bestPrice = todayPrice, bestDay = '', bestIdx = -1;
  predictions.forEach((p, i) => {
    if (Math.round(p.predicted_price) > bestPrice) {
      bestPrice = Math.round(p.predicted_price); bestDay = weekday(p.date); bestIdx = i;
    }
  });
  const gain = Math.round(bestPrice - todayPrice);
  const holdDays = bestIdx >= 0 ? bestIdx + 1 : 0;
  const avgConf = predictions.length
    ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length)
    : 0;
  const shouldSell = gain <= 0;

  const dayStrip = [
  { label: 'Aaj', sublabel: new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short'}), price: todayPrice, idx: 0 },
  ...predictions
    .filter(p => new Date(p.date) > new Date())  // sirf future dates
    .slice(0, 6)
    .map((p, i) => ({
      label: new Date(p.date).toLocaleDateString('en-IN', {day:'numeric', month:'short'}),
      sublabel: '',
      price: Math.round(p.predicted_price), idx: i + 1,
    })),
];

  const recentActual = history.slice(-4).map(h => ({ label: weekday(h.date), actual: Math.round(h.modal_price), forecast: null }));
  const futureData = predictions.map(p => ({ label: weekday(p.date), actual: null, forecast: Math.round(p.predicted_price) }));
  const chartData = [...recentActual, ...futureData];
  const splitIdx = recentActual.length - 1;
  const forecastOnly = predictions.map(p => ({ label: weekday(p.date), price: Math.round(p.predicted_price) }));

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto">

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-br from-[#1e5631] via-[#2d6a3e] to-[#16a34a] px-6 pt-8 pb-8 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white/40">
              <img src="/kisan.png" alt="kisan" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-white/70 text-xs">🙏 नमस्ते</p>
              <p className="text-white font-semibold">{userName || 'Namaste'}</p>
            </div>
          </div>
          <button onClick={() => navigate('/alerts')} className="relative p-2.5 bg-white/20 backdrop-blur rounded-xl border border-white/30">
            <Bell className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#f97316] rounded-full text-white text-xs flex items-center justify-center font-bold">3</span>
          </button>
        </div>

        <p className="text-white text-lg font-semibold mb-4">फसल की कीमत देखें</p>

        {/* ── MANDI DROPDOWN ── */}
        <div className="mb-3 relative">
          <p className="text-white/70 text-xs mb-1.5 ml-1">मंडी चुनें</p>
          <button onClick={() => setShowMandiDropdown(!showMandiDropdown)}
            className="w-full bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-3.5 flex items-center justify-between border border-white/20">
            {selectedMandi ? (
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedMandi.emoji}</span>
                <div className="text-left">
                  <p className="text-white font-medium text-sm">{selectedMandi.label}</p>
                  <p className="text-white/60 text-xs">{selectedMandi.sublabel} · {selectedMandi.km}</p>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-sm">मंडी का नाम चुनें…</p>
            )}
            <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${showMandiDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showMandiDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              {MARKETS.map(mandi => (
                <button key={mandi.value}
                  onClick={() => { setSelectedMarket(mandi.value); localStorage.setItem('selectedMarket', mandi.value); setShowMandiDropdown(false); setShowResult(false); }}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${selectedMarket === mandi.value ? 'bg-[#e8f5e9]' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${selectedMarket === mandi.value ? 'bg-[#2d6a3e]/10' : 'bg-gray-100'}`}>{mandi.emoji}</div>
                  <div className="flex-1 text-left">
                    <p className={`font-medium text-sm ${selectedMarket === mandi.value ? 'text-[#2d6a3e]' : 'text-gray-800'}`}>{mandi.label}</p>
                    <p className="text-xs text-gray-400">{mandi.sublabel} · {mandi.km}</p>
                  </div>
                  {selectedMarket === mandi.value && <Check className="w-5 h-5 text-[#2d6a3e]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CROP GRID (inline, no extra screen) ── */}
        <div>
          <p className="text-white/70 text-xs mb-1.5 ml-1">फसल चुनें</p>
          <div className="grid grid-cols-4 gap-2">
            {CROPS.map(crop => {
              const isSelected = selectedCrop === crop.name;
              return (
                <button key={crop.name}
                  onClick={() => { setSelectedCrop(crop.name); localStorage.setItem('selectedCrop', crop.name); setShowResult(false); }}
                  className={`flex flex-col items-center py-3 px-1 rounded-2xl border-2 transition-all ${isSelected ? 'bg-white border-white' : 'bg-white/15 border-white/20'}`}>
                  <span className="text-2xl mb-1">{crop.emoji}</span>
                  <p className={`text-xs font-medium leading-tight text-center ${isSelected ? 'text-[#2d6a3e]' : 'text-white'}`}>{crop.hindi}</p>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#2d6a3e] mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SEARCH BUTTON ── */}
        <button onClick={handleSearch} disabled={!canSearch || loading}
          className={`w-full mt-4 py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${canSearch ? 'bg-[#f97316] text-white shadow-lg active:scale-95' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          {loading ? 'लोड हो रहा है…' : 'कीमत देखें'}
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

      {/* ── RESULTS ── */}
      {showResult && !loading && (
        <div className="px-5 mt-4 space-y-4">

          {/* AAJ KI KIMAT */}
          <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">आज की कीमत</p>
                <p className="text-sm font-bold text-gray-800">{selectedCropObj?.emoji} {selectedCropObj?.hindi} · <span className="font-bold text-gray-800">{selectedMandi?.label}</span></p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 font-semibold ${priceDiff >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {priceDiff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceDiff >= 0 ? '+' : ''}₹{Math.abs(priceDiff)} | {yesterdayDateStr}
              </div>
            </div>

            {/* Price + Range box */}
            <div className="bg-[#f0f7f1] rounded-2xl px-4 py-3 mb-4">
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-5xl font-bold text-[#1b4228]">₹{displayPrice.toLocaleString()}</p>
                <p className="text-gray-400 text-sm">प्रति क्विंटल{selectedPred ? ' · अनुमानित' : ''}</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">न्यूनतम</p>
                  <p className="text-base font-semibold text-gray-700">₹{displayRange.low.toLocaleString()}</p>
                </div>
                <div className="w-px h-8 bg-gray-300" />
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">अधिकतम</p>
                  <p className="text-base font-semibold text-gray-700">₹{displayRange.high.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* 7-day strip */}
            <p className="text-xs text-gray-400 mb-2">दिन चुनें:</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {dayStrip.map(day => (
                <button key={day.idx} onClick={() => setSelectedDayIdx(day.idx)}
                  className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all ${selectedDayIdx === day.idx ? 'bg-[#2d6a3e] border-[#2d6a3e]' : 'bg-gray-50 border-transparent'}`}>
                  <p className={`text-xs font-bold ${selectedDayIdx === day.idx ? 'text-white' : 'text-gray-600'}`}>{day.label}</p>
                  <p className={`text-xs mt-0.5 ${selectedDayIdx === day.idx ? 'text-white/80' : 'text-gray-400'}`}>₹{day.price}</p>
                </button>
              ))}
            </div>
          </div>

          {/* MANDI TULNA - inline expandable */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button onClick={loadCompare} className="w-full px-4 py-3.5 flex items-center gap-3 active:scale-95 transition-all">
              <div className="w-10 h-10 bg-[#e8f5e9] rounded-xl flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-[#2d6a3e]" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-800">मंडी तुलना</p>
                <p className="text-xs text-gray-400">कौन सी मंडी सबसे अच्छी?</p>
              </div>
              {showCompare ? <ChevronUp className="w-4 h-4 text-[#2d6a3e]" /> : <ChevronDown className="w-4 h-4 text-[#2d6a3e]" />}
            </button>

            {showCompare && (
              <div className="px-4 pb-4 space-y-3">
                {compareLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-[#2d6a3e]" /></div>}
                {!compareLoading && compareData.filter(m => m.isBest).map(m => (
                  <div key={m.value} className="bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-2xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                      <p className="text-xs font-semibold">यहाँ बेचना सबसे फायदेमंद</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold">{m.emoji} {m.name}</p>
                      <p className="text-xl font-bold">₹{m.price.toLocaleString()}</p>
                    </div>
                    <p className="text-xs text-white/70 text-right">प्रति क्विंटल</p>
                  </div>
                ))}
                {!compareLoading && compareData.map(m => (
                  <div key={m.value} className={`bg-gray-50 rounded-2xl p-4 border-2 ${m.isBest ? 'border-[#f97316]/30' : 'border-transparent'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{m.emoji}</span>
                        <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                      </div>
                      <button onClick={() => window.open(`https://maps.google.com/?q=${m.name}+Delhi`, '_blank')}
                        className="p-1.5 rounded-lg border border-[#2d6a3e] text-[#2d6a3e]">
                        <Navigation className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-end justify-between mt-2">
                      <p className="text-2xl font-bold text-[#1b4228]">{m.price > 0 ? `₹${m.price.toLocaleString()}` : 'N/A'}</p>
                      {m.price > 0 && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-xl ${m.change > 0 ? 'bg-green-50 text-green-700' : m.change < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                          {m.change > 0 ? <TrendingUp className="w-3 h-3" /> : m.change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {m.change > 0 ? `कल से ₹${m.change} बढ़ी` : m.change < 0 ? `कल से ₹${Math.abs(m.change)} घटी` : 'कल जैसी कीमत'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI RECOMMENDATION */}
          <div className={`rounded-3xl p-5 border-2 ${shouldSell ? 'bg-red-50 border-red-200' : 'bg-gradient-to-br from-[#fffbf5] to-[#fff7ed] border-[#f97316]/20'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${shouldSell ? 'bg-red-500' : 'bg-[#f97316]'}`}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800 text-sm">AI सलाह</p>
                <p className="text-xs text-gray-400">{avgConf}% भरोसा</p>
              </div>
              <button onClick={() => navigate('/prediction')} className="text-xs text-[#2d6a3e] flex items-center gap-1">
                विस्तार <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {shouldSell ? (
              <p className="text-lg font-bold text-red-700">अभी बेचें — कीमत बढ़ने की उम्मीद नहीं</p>
            ) : (
              <>
                <p className="text-lg font-bold text-[#1b4228]">{holdDays} दिन रुकें → ₹{gain} ज़्यादा मिलेगा</p>
                {bestDay && <p className="text-sm text-gray-500 mt-1">सबसे अच्छा दिन: <span className="text-[#f97316] font-semibold">{bestDay} — ₹{bestPrice.toLocaleString()}</span></p>}
              </>
            )}

            <div className="flex items-center gap-1.5 mt-3">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 rounded-full flex-1 ${i < Math.round(avgConf / 20) ? (shouldSell ? 'bg-red-400' : 'bg-[#f97316]') : 'bg-gray-200'}`} />
              ))}
              <span className="text-xs text-gray-400 ml-1">{avgConf}%</span>
            </div>
          </div>

          {/* CHART TOGGLE */}
          <ChartSection forecastOnly={forecastOnly} />

          {/* MANDI JANKARI - flat horizontal strip */}
          <button onClick={() => navigate('/mandi-info')}
            className="w-full bg-[#fff7ed] rounded-2xl px-4 py-3.5 border border-[#f97316]/20 flex items-center gap-3 hover:border-[#f97316]/50 hover:shadow-sm transition-all active:scale-95 mb-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Building2 className="w-5 h-5 text-[#f97316]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-800">मंडी जानकारी</p>
              <p className="text-xs text-gray-400">सभी फसलों के भाव देखें</p>
            </div>
            <span className="text-xs text-[#f97316] font-semibold">देखें →</span>
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}