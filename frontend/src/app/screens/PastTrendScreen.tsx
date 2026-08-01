import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, BarChart2, AlertCircle, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { mandiApi } from '../../mandiq-api';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from 'recharts';

const CROPS = [
  { name: 'Tomato', hindi: 'टमाटर', emoji: '🍅' },
  { name: 'Potato', hindi: 'आलू', emoji: '🥔' },
  { name: 'Onion', hindi: 'प्याज', emoji: '🧅' },
  { name: 'Spinach', hindi: 'पालक', emoji: '🌿' },
];

const MARKETS = [
  { value: 'Azadpur APMC', label: 'आज़ादपुर' },
  { value: 'Keshopur APMC', label: 'केशोपुर' },
];

const PERIODS = [
  { label: '1 महीना', days: 30 },
  { label: '3 महीने', days: 90 },
  { label: '6 महीने', days: 180 },
];

const DAYS = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export function PastTrendScreen() {
  const nav = useNavigate();
  const [crop, setCrop] = useState(localStorage.getItem('selectedCrop') || 'Tomato');
  const [market, setMarket] = useState(localStorage.getItem('selectedMarket') || 'Azadpur APMC');
  const [period, setPeriod] = useState(30);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [crop, market, period]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - period);
      const h = await mandiApi.getHistory(
        crop, market,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0]
      );
      setHistory(h);
    } catch {
      setError('डेटा लोड नहीं हो सका');
    }
    setLoading(false);
  }

  const cropObj = CROPS.find(c => c.name === crop)!;
  const marketObj = MARKETS.find(m => m.value === market)!;

  // Chart data
  const chartData = history.map(h => ({
    date: new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    price: Math.round(h.modal_price),
    arrival: Math.round(h.arrival_qty || 0),
  }));

  // Stats
  const prices = history.map(h => h.modal_price);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const minPrice = prices.length ? Math.round(Math.min(...prices)) : 0;
  const maxPrice = prices.length ? Math.round(Math.max(...prices)) : 0;
  const minDate = prices.length ? history[prices.indexOf(Math.min(...prices))]?.date : '';
  const maxDate = prices.length ? history[prices.indexOf(Math.max(...prices))]?.date : '';
  const latestPrice = prices.length ? Math.round(prices[prices.length - 1]) : 0;
  const firstPrice = prices.length ? Math.round(prices[0]) : 0;
  const overallChange = latestPrice - firstPrice;
  const changePct = firstPrice ? Math.round((overallChange / firstPrice) * 100) : 0;

  // Volatility
  const variance = prices.length > 1
    ? prices.reduce((s, p) => s + (p - avgPrice) ** 2, 0) / prices.length
    : 0;
  const stdDev = Math.round(Math.sqrt(variance));
  const volatility = avgPrice ? Math.round((stdDev / avgPrice) * 100) : 0;
  const volatilityLabel = volatility < 5 ? 'स्थिर' : volatility < 15 ? 'सामान्य' : 'अस्थिर';
  const volatilityColor = volatility < 5 ? 'text-green-600' : volatility < 15 ? 'text-yellow-600' : 'text-red-500';

  // Best day of week to sell
  const dayMap: Record<number, number[]> = {};
  history.forEach(h => {
    const day = new Date(h.date).getDay();
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(h.modal_price);
  });
  const dayAvgs = Object.entries(dayMap).map(([d, ps]) => ({
    day: parseInt(d),
    avg: Math.round(ps.reduce((a, b) => a + b, 0) / ps.length),
  }));
  const bestDay = dayAvgs.length ? dayAvgs.reduce((a, b) => b.avg > a.avg ? b : a) : null;
  const worstDay = dayAvgs.length ? dayAvgs.reduce((a, b) => b.avg < a.avg ? b : a) : null;

  // Price trend last 7 days
  const last7 = history.slice(-7);
  const trend7 = last7.length > 1
    ? last7[last7.length - 1].modal_price - last7[0].modal_price
    : 0;

  // Arrival trend
  const arrivals = history.filter(h => h.arrival_qty).map(h => h.arrival_qty);
  const avgArrival = arrivals.length ? Math.round(arrivals.reduce((a, b) => a + b, 0) / arrivals.length) : 0;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' }) : '';

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-24 max-w-md mx-auto">

      {/* Header */}
      <div className="bg-gradient-to-br from-[#1e5631] via-[#2d6a3e] to-[#16a34a] px-6 pt-8 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => nav('/home')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">पिछला ट्रेंड</h2>
            <p className="text-white/70 text-xs">भाव का इतिहास और विश्लेषण</p>
          </div>
        </div>

        {/* Crop selector */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {CROPS.map(c => (
            <button key={c.name} onClick={() => { setCrop(c.name); localStorage.setItem('selectedCrop', c.name); }}
              className={`flex flex-col items-center py-2 rounded-xl border-2 transition-all ${crop === c.name ? 'bg-white border-white' : 'bg-white/15 border-white/20'}`}>
              <span className="text-lg">{c.emoji}</span>
              <p className={`text-[10px] font-medium mt-0.5 ${crop === c.name ? 'text-[#2d6a3e]' : 'text-white'}`}>{c.hindi}</p>
            </button>
          ))}
        </div>

        {/* Market selector */}
        <div className="grid grid-cols-2 gap-2">
          {MARKETS.map(m => (
            <button key={m.value} onClick={() => setMarket(m.value)}
              className={`py-2 rounded-xl text-sm font-medium border-2 transition-all ${market === m.value ? 'bg-white text-[#2d6a3e] border-white' : 'bg-white/15 text-white border-white/20'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* Period selector */}
        <div className="flex gap-2">
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${period === p.days ? 'bg-[#2d6a3e] text-white border-[#2d6a3e]' : 'bg-white text-gray-500 border-gray-100'}`}>
              {p.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#2d6a3e]" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 rounded-2xl p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && history.length > 0 && (
          <>
            {/* Overall change banner */}
            <div className={`rounded-2xl p-4 flex items-center justify-between ${overallChange >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div>
                <p className="text-xs text-gray-500">{period} दिन में बदलाव</p>
                <p className={`text-2xl font-bold ${overallChange >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {overallChange >= 0 ? '+' : ''}₹{overallChange} ({changePct}%)
                </p>
                <p className="text-xs text-gray-400">{fmtDate(history[0]?.date)} → आज</p>
              </div>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${overallChange >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {overallChange >= 0 ? <TrendingUp className="w-8 h-8 text-green-600" /> : <TrendingDown className="w-8 h-8 text-red-500" />}
              </div>
            </div>

            {/* Price Chart */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-5 h-5 text-[#2d6a3e]" />
                <p className="font-semibold text-gray-800">भाव का ग्राफ</p>
                <span className="ml-auto text-xs text-gray-400">{cropObj.emoji} {marketObj.label}</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2d6a3e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2d6a3e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.floor(chartData.length / 5)} />
                  <YAxis tick={{ fontSize: 9 }} width={45} tickFormatter={v => `₹${v}`} />
                  <Tooltip
                    formatter={(v: any) => [`₹${v}`, 'भाव']}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e5e7eb' }}
                  />
                  <ReferenceLine y={avgPrice} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'औसत', fontSize: 9, fill: '#f97316' }} />
                  <Area type="monotone" dataKey="price" stroke="#2d6a3e" strokeWidth={2} fill="url(#priceGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 text-center mt-1">नारंगी रेखा = औसत भाव ₹{avgPrice}</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                <p className="text-xs text-gray-400 mb-1">औसत</p>
                <p className="text-lg font-bold text-[#1b4228]">₹{avgPrice}</p>
                <p className="text-[10px] text-gray-400">प्रति क्विंटल</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-100 text-center">
                <p className="text-xs text-gray-400 mb-1">न्यूनतम</p>
                <p className="text-lg font-bold text-red-600">₹{minPrice}</p>
                <p className="text-[10px] text-gray-400">{fmtDate(minDate)}</p>
              </div>
              <div className="bg-green-50 rounded-2xl p-4 shadow-sm border border-green-100 text-center">
                <p className="text-xs text-gray-400 mb-1">अधिकतम</p>
                <p className="text-lg font-bold text-green-600">₹{maxPrice}</p>
                <p className="text-[10px] text-gray-400">{fmtDate(maxDate)}</p>
              </div>
            </div>

            {/* Last 7 days trend */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
              <p className="font-semibold text-gray-800 mb-3">पिछले 7 दिन का ट्रेंड</p>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${trend7 > 0 ? 'bg-green-50' : trend7 < 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  {trend7 > 0 ? <TrendingUp className="w-6 h-6 text-green-600" /> : trend7 < 0 ? <TrendingDown className="w-6 h-6 text-red-500" /> : <Minus className="w-6 h-6 text-gray-400" />}
                </div>
                <div>
                  <p className={`text-lg font-bold ${trend7 > 0 ? 'text-green-600' : trend7 < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    {trend7 > 0 ? '+' : ''}₹{trend7}
                  </p>
                  <p className="text-xs text-gray-400">
                    {trend7 > 0 ? '7 दिन में भाव बढ़ा' : trend7 < 0 ? '7 दिन में भाव घटा' : '7 दिन में कोई बदलाव नहीं'}
                  </p>
                </div>
              </div>
            </div>

          </>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-gray-500 text-sm">इस अवधि का डेटा उपलब्ध नहीं है</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
