import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ThumbsUp, ThumbsDown, Cloud, TrendingUp, AlertCircle, Loader2, Calendar, Target } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { SupportChat } from '../components/SupportChat';
import { Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart, ReferenceLine, CartesianGrid } from 'recharts';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { mandiApi, type Prediction, type PriceRecord } from '../../mandiq-api';
import { useT } from '../../i18n';

const CROP_ICONS: Record<string, string> = {
  Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿',
  Cauliflower: '🥦', Mango: '🥭', Apple: '🍎', Wheat: '🌾', Rice: '🌾',
};

const ML: Record<string, string> = {
  'Azadpur APMC': 'Azadpur Mandi',
  'Keshopur APMC': 'Keshopur Mandi',
};

function wd(d: string) { return new Date(d).toLocaleDateString('en-US', { weekday: 'short' }); }

const CustomDot = (props: any) => {
  const { cx, cy, payload, bestDay } = props;
  const isBest = bestDay && payload.day === bestDay;
  if (isBest) return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="#f97316" opacity={0.2} />
      <circle cx={cx} cy={cy} r={6} fill="#f97316" stroke="#fff" strokeWidth={2} />
    </g>
  );
  return <circle cx={cx} cy={cy} r={4} fill="#2d6a3e" stroke="#fff" strokeWidth={1.5} />;
};

export function PredictionScreen() {
  const nav = useNavigate(); const { t } = useT();
  const [fb, setFb] = useState<'up' | 'down' | null>(null);
  const [cm, setCm] = useState('');
  const [cmErr, setCmErr] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const crop = localStorage.getItem('selectedCrop') || 'Tomato';
  const mkt = localStorage.getItem('selectedMarket') || 'Azadpur APMC';
  const ml = ML[mkt] || mkt;
  const [ld, setLd] = useState(true);
  const [er, setEr] = useState<string | null>(null);
  const [hist, setHist] = useState<PriceRecord[]>([]);
  const [preds, setPreds] = useState<Prediction[]>([]);

  useEffect(() => {
    let c = false;
    async function l() {
      setLd(true); setEr(null);
      try {
        const [h, p] = await Promise.all([mandiApi.getHistory(crop, mkt), mandiApi.predict(crop, 7, mkt)]);
        if (c) return; setHist(h); setPreds(p);
      } catch (e: any) { if (c) return; setEr(e?.message || 'err'); }
      finally { if (!c) setLd(false); }
    }
    l(); return () => { c = true; };
  }, [crop, mkt]);

  const tp = hist.length ? Math.round(hist[hist.length - 1].modal_price) : 0;
  const cd = preds.map(p => ({
    day: wd(p.date),
    price: Math.round(p.predicted_price),
    lower: Math.round(p.lower_bound),
    upper: Math.round(p.upper_bound),
  }));

  let bp = tp, bd = '', bi = -1;
  preds.forEach((p, i) => {
    if (Math.round(p.predicted_price) > bp) { bp = Math.round(p.predicted_price); bd = wd(p.date); bi = i; }
  });

  const ac = preds.length ? Math.round(preds.reduce((s, p) => s + p.confidence, 0) / preds.length) : 0;
  const confColor = ac >= 80 ? '#16a34a' : ac >= 60 ? '#f97316' : '#ef4444';

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1e5631] via-[#2d6a3e] to-[#16a34a] px-6 pt-8 pb-6 rounded-b-[2rem] shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => nav('/home')} className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/30">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white">{t('pred.title')}</h2>
            <p className="text-white/60 text-xs">AI-powered price forecast</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* Crop + Market Info */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#f0fdf4] rounded-2xl flex items-center justify-center text-2xl">
              {CROP_ICONS[crop] || '🌱'}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{crop}</p>
              <p className="text-xs text-gray-400">{t('pred.selectedCrop')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{ml}</p>
            <p className="text-xs text-gray-400">{t('pred.location')}</p>
          </div>
        </div>

        {ld && (
          <div className="flex items-center gap-2 text-[#2d6a3e] py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">{t('pred.generating')}</span>
          </div>
        )}

        {er && !ld && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm text-red-700 font-medium">{t('common.dataError')}</p>
            <p className="text-xs text-red-500 mt-1">{er}</p>
            <p className="text-xs text-gray-400 mt-2">{t('pred.noModel')}</p>
          </div>
        )}

        {!ld && !er && <>
          {/* Current Price Banner */}
          <div className="bg-gradient-to-br from-[#1e5631] to-[#2d6a3e] rounded-2xl p-5 text-white flex items-center justify-between">
            <div>
              <p className="text-white/70 text-xs mb-1">Current Price</p>
              <p className="text-3xl font-bold">₹{tp.toLocaleString()}</p>
              <p className="text-white/60 text-xs mt-1">per quintal</p>
            </div>
            {bp > tp && (
              <div className="text-right">
                <p className="text-white/70 text-xs mb-1">Best Forecast</p>
                <p className="text-2xl font-bold text-[#4ade80]">₹{bp.toLocaleString()}</p>
                <p className="text-white/60 text-xs mt-1">on {bd}</p>
              </div>
            )}
          </div>

          {/* Forecast Chart */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-0.5">{t('pred.forecast')}</h3>
              <p className="text-xs text-gray-400">{t('pred.withCI')}</p>
            </div>

           

            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={cd} margin={{ top: 15, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d6a3e" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2d6a3e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0ee" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }}
                  domain={['dataMin - 200', 'dataMax + 200']} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #f0f0ee', borderRadius: '12px', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v: number, n: string) => {
                    if (n === 'upper') return [`₹${v.toLocaleString()}`, 'Upper bound'];
                    if (n === 'lower') return [`₹${v.toLocaleString()}`, 'Lower bound'];
                    return [`₹${v.toLocaleString()}`, 'Predicted Price'];
                  }}
                />
                {/* CI Band — upper fill */}
                <Area type="monotone" dataKey="upper" stroke="#2d6a3e" strokeWidth={0}
                  fill="url(#ciGrad)" fillOpacity={1} legendType="none" />
                {/* CI Band — lower wipes out fill below */}
                <Area type="monotone" dataKey="lower" stroke="#2d6a3e" strokeWidth={0}
                  fill="white" fillOpacity={1} legendType="none" />
                {/* Main price line — on top */}
                <Area type="monotone" dataKey="price" stroke="#2d6a3e" strokeWidth={3}
                  fill="none"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const isBest = bd && payload.day === bd;
                    if (isBest) return (
                      <g key={`dot-${cx}`}>
                        <circle cx={cx} cy={cy} r={10} fill="#f97316" opacity={0.2} />
                        <circle cx={cx} cy={cy} r={6} fill="#f97316" stroke="#fff" strokeWidth={2} />
                      </g>
                    );
                    return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={4} fill="#2d6a3e" stroke="#fff" strokeWidth={1.5} />;
                  }}
                  activeDot={{ r: 7, fill: '#2d6a3e', stroke: '#fff', strokeWidth: 2 }}
                />
                {/* Best day vertical line */}
                {bd && <ReferenceLine x={bd} stroke="#f97316" strokeDasharray="4 4" strokeWidth={1.5} />}
              </AreaChart>
            </ResponsiveContainer>

            {bd && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Target className="w-4 h-4 text-[#f97316]" />
                  <span>{t('pred.bestSellDay')}</span>
                </div>
                <span className="text-[#f97316] font-bold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]"></span>
                  {bd} — ₹{bp.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Cost Benefit */}
          {/* Demand Level */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-[#e8f5e9] rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#16a34a]" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">{t('pred.demand')}</p>
                <p className="text-xs text-gray-400">Seasonal market analysis</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-gradient-to-r from-[#16a34a] to-[#4ade80] h-2.5 rounded-full transition-all" style={{ width: '75%' }} />
              </div>
              <span className="text-sm text-[#16a34a] font-semibold">{t('pred.high')}</span>
            </div>
            <p className="text-sm text-gray-400">{t('pred.demandText')}</p>
          </div>

          {/* Weather */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 bg-[#fff7ed] rounded-2xl flex items-center justify-center">
                <Cloud className="w-5 h-5 text-[#f97316]" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">{t('pred.weatherImpact')}</p>
                <p className="text-xs text-gray-400">Producing region + Delhi</p>
              </div>
            </div>
            <p className="text-sm text-gray-400">{t('pred.weatherText')}</p>
          </div>

          {/* Confidence */}
          <div className="bg-gradient-to-br from-[#fffbf5] to-white rounded-3xl p-5 border border-[#f97316]/15 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-[#f97316] rounded-2xl flex items-center justify-center shadow-sm">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">{t('pred.confidence')}</p>
                <p className="text-xs text-gray-400">Model prediction reliability</p>
              </div>
            </div>

            {/* Confidence Circle */}
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={confColor} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 34 * ac / 100} ${2 * Math.PI * 34}`}
                    strokeLinecap="round" className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold" style={{ color: confColor }}>{ac}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 flex-1">{t('pred.confText')}</p>
            </div>

            <div className="border-t border-[#f97316]/15 pt-4">
              {submitted ? (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-xl">🙏</span>
                  <p className="text-sm font-medium text-[#2d6a3e]">{t('pred.submitted')}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700 mb-3">{t('pred.wasAccurate')}</p>
                  <div className="flex gap-3 mb-3">
                    <button onClick={() => { setFb('up'); setCm(''); setCmErr(''); }}
                      className={`flex-1 py-3 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${fb === 'up' ? 'bg-[#16a34a] border-[#16a34a] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-[#16a34a]/50'}`}>
                      <ThumbsUp className="w-4 h-4" />{t('pred.yes')}
                    </button>
                    <button onClick={() => { setFb('down'); setCm(''); setCmErr(''); }}
                      className={`flex-1 py-3 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-medium ${fb === 'down' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'}`}>
                      <ThumbsDown className="w-4 h-4" />{t('pred.no')}
                    </button>
                  </div>
                  {fb && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder={fb === 'down' ? t('pred.feedbackReqPh') : t('pred.feedbackOptPh')}
                        value={cm}
                        onChange={(e) => { setCm(e.target.value); if (e.target.value.trim()) setCmErr(''); }}
                        className={`rounded-2xl resize-none text-sm ${cmErr ? 'border-red-400' : 'border-gray-200'}`}
                        rows={3}
                      />
                      {cmErr && <p className="text-xs text-red-500">{cmErr}</p>}
                      <Button
                        className="w-full bg-[#2d6a3e] hover:bg-[#1b4228] rounded-2xl font-semibold"
                        onClick={async () => {
                          if (fb === 'down' && !cm.trim()) {
                            setCmErr(t('pred.requiredErr'));
                            return;
                          }
                          try {
                            const token = localStorage.getItem('mandiq_token');
                            const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
                            await fetch(`${BASE_URL}/api/prediction/feedback`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                              },
                              body: JSON.stringify({ crop, market: mkt, accurate: fb === 'up' ? 'yes' : 'no', comment: cm }),
                            });
                          } catch { }
                          setSubmitted(true);
                        }}
                      >
                        {t('pred.submit')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>}
      </div>
      <BottomNav />
      <SupportChat />
    </div>
  );
}