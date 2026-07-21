import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Bell, Target, TrendingUp, Trash2, CheckCircle } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const CROP_HINDI: Record<string, string> = { Tomato: 'टमाटर', Potato: 'आलू', Onion: 'प्याज', Spinach: 'पालक' };
const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };
const SK = 'mandiq_user_alerts';
const BDA = 'mandiq_best_day_alert';

type UA = { id: number; crop: string; targetPrice: number; createdAt: string };

function la(): UA[] { try { return JSON.parse(localStorage.getItem(SK) || '[]'); } catch { return []; } }

export function AlertsScreen() {
  const nav = useNavigate();
  const crop = localStorage.getItem('selectedCrop') || 'Tomato';
  const cropHindi = CROP_HINDI[crop] || crop;
  const cropIcon = CROP_ICONS[crop] || '🌱';

  const [tp, setTp] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(crop);
  const [ua, setUa] = useState<UA[]>([]);
  const [bestDayOn, setBestDayOn] = useState(localStorage.getItem(BDA) === 'true');
  const [added, setAdded] = useState(false);

  useEffect(() => { setUa(la()); }, []);

  const ps = (l: UA[]) => { setUa(l); localStorage.setItem(SK, JSON.stringify(l)); };

  const cr = () => {
    const p = parseFloat(tp);
    if (!p || p <= 0) return;
    ps([{ id: Date.now(), crop: selectedCrop, targetPrice: p, createdAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }, ...ua]);
    setTp('');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const toggleBestDay = () => {
    const next = !bestDayOn;
    setBestDayOn(next);
    localStorage.setItem(BDA, String(next));
  };

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#1e5631] via-[#2d6a3e] to-[#16a34a] px-6 pt-8 pb-6 rounded-b-[2rem] shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/home')} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">अलर्ट सेट करें</h2>
            <p className="text-white/70 text-xs">सही समय पर सूचना पाएं</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* ALERT 1 — Target Price */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-[#e8f5e9] rounded-2xl flex items-center justify-center">
              <Target className="w-5 h-5 text-[#2d6a3e]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">लक्ष्य कीमत अलर्ट</p>
              <p className="text-xs text-[#2d6a3e] font-medium">जब कीमत आपके लक्ष्य पर पहुँचे</p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-[#f0fdf4] rounded-2xl p-4 mb-4 space-y-2">
            <p className="text-xs font-semibold text-[#2d6a3e] uppercase tracking-wide">यह कैसे काम करता है?</p>
            <div className="flex items-start gap-2">
              <span className="text-base">1️⃣</span>
              <p className="text-xs text-gray-600">नीचे वह कीमत लिखें जिस पर आप बेचना चाहते हैं</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base">2️⃣</span>
              <p className="text-xs text-gray-600">जब फसल की मंडी कीमत उस लक्ष्य पर पहुँचेगी</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base">3️⃣</span>
              <p className="text-xs text-gray-600">आपको तुरंत सूचना मिलेगी — बेचने का सही समय!</p>
            </div>
          </div>

          {/* Input */}
          <div className="mb-3">
            <p className="text-xs text-gray-400 mb-2">फसल चुनें:</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[{name:'Tomato',hindi:'टमाटर',emoji:'🍅'},{name:'Potato',hindi:'आलू',emoji:'🥔'},{name:'Onion',hindi:'प्याज',emoji:'🧅'},{name:'Spinach',hindi:'पालक',emoji:'🌿'}].map(c => (
                <button key={c.name} onClick={() => setSelectedCrop(c.name)}
                  className={`flex flex-col items-center py-2.5 px-1 rounded-2xl border-2 transition-all ${selectedCrop === c.name ? 'bg-[#2d6a3e] border-[#2d6a3e]' : 'bg-gray-50 border-gray-100'}`}>
                  <span className="text-xl mb-1">{c.emoji}</span>
                  <p className={`text-xs font-medium leading-tight text-center ${selectedCrop === c.name ? 'text-white' : 'text-gray-600'}`}>{c.hindi}</p>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-gray-50 rounded-2xl px-4 border-2 border-gray-100 focus-within:border-[#2d6a3e]">
                <span className="text-gray-400 font-semibold mr-2">₹</span>
                <input
                  type="number"
                  placeholder="लक्ष्य कीमत लिखें..."
                  value={tp}
                  onChange={e => setTp(e.target.value)}
                  className="flex-1 py-3 bg-transparent outline-none text-sm text-gray-800"
                />
                <span className="text-gray-400 text-xs">/क्विंटल</span>
              </div>
              <button onClick={cr} disabled={!tp || parseFloat(tp) <= 0}
                className={`px-4 py-3 rounded-2xl font-semibold text-sm transition-all ${tp && parseFloat(tp) > 0 ? 'bg-[#2d6a3e] text-white active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                सेट करें
              </button>
            </div>
          </div>

          {added && (
            <div className="flex items-center gap-2 bg-green-50 rounded-xl px-4 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs text-green-700 font-medium">अलर्ट सेट हो गया! ✓</p>
            </div>
          )}
        </div>

        {/* ALERT 2 — Best Day */}
        <div className={`bg-white rounded-3xl p-5 border-2 shadow-sm transition-all ${bestDayOn ? 'border-[#f97316]' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${bestDayOn ? 'bg-[#fff7ed]' : 'bg-gray-50'}`}>
              <TrendingUp className={`w-5 h-5 ${bestDayOn ? 'text-[#f97316]' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">सबसे अच्छे दिन का अलर्ट</p>
              <p className={`text-xs font-medium ${bestDayOn ? 'text-[#f97316]' : 'text-gray-400'}`}>
                {bestDayOn ? '✓ चालू है' : 'अभी बंद है'}
              </p>
            </div>
            <button onClick={toggleBestDay}
              className={`relative w-12 h-6 rounded-full transition-colors ${bestDayOn ? 'bg-[#f97316]' : 'bg-gray-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${bestDayOn ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* How it works */}
          <div className={`rounded-2xl p-4 space-y-2 ${bestDayOn ? 'bg-[#fff7ed]' : 'bg-gray-50'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${bestDayOn ? 'text-[#f97316]' : 'text-gray-400'}`}>यह कैसे काम करता है?</p>
            <div className="flex items-start gap-2">
              <span className="text-base">🤖</span>
              <p className="text-xs text-gray-600">हमारा AI रोज़ाना अगले 7 दिनों की कीमत का अनुमान लगाता है</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base">📅</span>
              <p className="text-xs text-gray-600">जिस दिन कीमत सबसे ज़्यादा होगी — उस दिन सुबह आपको सूचना मिलेगी</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-base">💰</span>
              <p className="text-xs text-gray-600">सही दिन बेचें — ज़्यादा मुनाफा कमाएं</p>
            </div>
          </div>
        </div>

        {/* MY ALERTS */}
        {ua.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-[#2d6a3e]" />
              <p className="font-semibold text-gray-800">मेरे अलर्ट ({ua.length})</p>
            </div>
            <div className="space-y-3">
              {ua.map(a => (
                <div key={a.id} className="flex items-center justify-between bg-[#f0fdf4] rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{CROP_ICONS[a.crop] || '🌱'}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{CROP_HINDI[a.crop] || a.crop}</p>
                      <p className="text-xs text-gray-500">जब कीमत <span className="text-[#2d6a3e] font-bold">₹{a.targetPrice}</span> पहुँचे</p>
                      <p className="text-xs text-gray-400">{a.createdAt} को बनाया</p>
                    </div>
                  </div>
                  <button onClick={() => { const l = ua.filter(x => x.id !== a.id); setUa(l); localStorage.setItem(SK, JSON.stringify(l)); }}
                    className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}