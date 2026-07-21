import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, TrendingUp, TrendingDown, Info, Bell, Sparkles, BarChart3, Building2, Sprout, Loader2, Check, Search } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { mandiApi, type Prediction, type PriceRecord } from '../../mandiq-api';
import { useT } from '../../i18n';

const MARKETS = [
  { value: 'Azadpur APMC', label: 'Azadpur Mandi', sublabel: 'Delhi (North)', emoji: '🏪', km: '12 km' },
  { value: 'Keshopur APMC', label: 'Keshopur Mandi', sublabel: 'Delhi (West)', emoji: '🏬', km: '18 km' },
  { value: 'Shahdara APMC', label: 'Shahdara Mandi', sublabel: 'Delhi (East)', emoji: '🏢', km: '25 km' },
];

const CROPS = [
  { name: 'Tomato', hindi: 'टमाटर', emoji: '🍅' },
  { name: 'Potato', hindi: 'आलू', emoji: '🥔' },
  { name: 'Onion', hindi: 'प्याज', emoji: '🧅' },
  { name: 'Spinach', hindi: 'पालक', emoji: '🌿' },
];

const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };

function weekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
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
  const navigate = useNavigate();
  const { t } = useT();

  // Selection state
  const [selectedMarket, setSelectedMarket] = useState(localStorage.getItem('selectedMarket') || '');
  const [selectedCrop, setSelectedCrop] = useState(localStorage.getItem('selectedCrop') || '');
  const [showMandiDropdown, setShowMandiDropdown] = useState(false);
  const [showResult, setShowResult] = useState(false);

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
  const yesterdayPrice = history.length > 1 ? Math.round(history[history.length - 2].modal_price) : todayPrice;
  const priceDiff = todayPrice - yesterdayPrice;

  const displayPrice = selectedDayIdx === 0
    ? todayPrice
    : selectedDayIdx <= predictions.length
      ? Math.round(predictions[selectedDayIdx - 1].predicted_price)
      : todayPrice;

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
    { label: 'Aaj', sublabel: 'Today', price: todayPrice, idx: 0 },
    ...predictions.slice(0, 6).map((p, i) => ({
      label: weekday(p.date), sublabel: prettyDate(p.date),
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
            <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center border border-white/30">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/70 text-xs">🙏 नमस्ते</p>
              <p className="text-white font-semibold">Ramesh Kumar</p>
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
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">आज की कीमत</p>
                <p className="text-xs text-gray-400">{selectedCropObj?.emoji} {selectedCropObj?.hindi} · {selectedMandi?.label}</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 font-semibold ${priceDiff >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {priceDiff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {priceDiff >= 0 ? '+' : ''}₹{Math.abs(priceDiff)} कल से
              </div>
            </div>

            <p className="text-5xl font-bold text-[#1b4228] mb-1">₹{displayPrice.toLocaleString()}</p>
            <p className="text-gray-400 text-sm mb-4">प्रति क्विंटल</p>

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

          {/* QUICK ACTIONS - sirf 2 */}
          <div className="grid grid-cols-2 gap-3 pb-2">
            <button onClick={() => navigate('/compare')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-start gap-2.5 hover:border-[#2d6a3e]/40 hover:shadow-md transition-all active:scale-95">
              <div className="w-10 h-10 bg-[#e8f5e9] rounded-xl flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[#2d6a3e]" /></div>
              <p className="text-sm font-medium text-gray-800">मंडी तुलना</p>
              <p className="text-xs text-gray-400">कौन सी मंडी सबसे अच्छी?</p>
            </button>
            <button onClick={() => navigate('/mandi-info')}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-start gap-2.5 hover:border-[#2d6a3e]/40 hover:shadow-md transition-all active:scale-95">
              <div className="w-10 h-10 bg-[#fff7ed] rounded-xl flex items-center justify-center"><Building2 className="w-5 h-5 text-[#f97316]" /></div>
              <p className="text-sm font-medium text-gray-800">मंडी जानकारी</p>
              <p className="text-xs text-gray-400">सभी फसलों के भाव</p>
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}