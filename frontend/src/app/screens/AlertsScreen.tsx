import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Bell, Target, TrendingUp, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const CROP_HINDI: Record<string, string> = { Tomato: 'टमाटर', Potato: 'आलू', Onion: 'प्याज', Spinach: 'पालक' };
const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };

type Alert = { id: number; crop: string; market: string; target_price: number; direction: string; created_at: string };

function authHeaders() {
  const token = localStorage.getItem('mandiq_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function AlertsScreen() {
  const nav = useNavigate();
  const crop = localStorage.getItem('selectedCrop') || 'Tomato';

  const [tp, setTp] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(crop);
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => { loadAlerts(); }, []);

  async function loadAlerts() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/alerts`, { headers: authHeaders() });
      if (r.ok) setAlerts(await r.json());
    } catch {}
    setLoading(false);
  }

  async function createAlert() {
    const p = parseFloat(tp);
    if (!p || p <= 0) return;
    setSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ crop: selectedCrop, market: 'Azadpur APMC', target_price: p, direction }),
      });
      if (r.ok) {
        setTp('');
        setAdded(true);
        setTimeout(() => setAdded(false), 2500);
        await loadAlerts();
      }
    } catch {}
    setSaving(false);
  }

  async function deleteAlert(id: number) {
    try {
      await fetch(`${BASE_URL}/api/alerts/${id}`, { method: 'DELETE', headers: authHeaders() });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  }

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
            <p className="text-white/70 text-xs">सही कीमत पर SMS मिलेगा</p>
          </div>
          <div className="ml-auto bg-white/20 px-3 py-1.5 rounded-xl">
            <p className="text-white text-xs font-semibold">📱 SMS अलर्ट</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">

        {/* How it works */}
        <div className="bg-[#e8f5e9] rounded-2xl p-4 border border-[#2d6a3e]/20">
          <p className="text-xs font-semibold text-[#2d6a3e] mb-2">📱 यह कैसे काम करता है?</p>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-600">1️⃣ नीचे लक्ष्य कीमत सेट करें</p>
            <p className="text-xs text-gray-600">2️⃣ जब मंडी में वो कीमत आएगी</p>
            <p className="text-xs text-gray-600">3️⃣ आपके मोबाइल पर SMS आएगा तुरंत!</p>
          </div>
        </div>

        {/* Create Alert */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-[#e8f5e9] rounded-2xl flex items-center justify-center">
              <Target className="w-5 h-5 text-[#2d6a3e]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">नया अलर्ट बनाएं</p>
              <p className="text-xs text-gray-400">SMS सूचना मिलेगी</p>
            </div>
          </div>

          {/* Crop */}
          <p className="text-xs text-gray-400 mb-2">फसल चुनें:</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[{name:'Tomato',hindi:'टमाटर',emoji:'🍅'},{name:'Potato',hindi:'आलू',emoji:'🥔'},{name:'Onion',hindi:'प्याज',emoji:'🧅'},{name:'Spinach',hindi:'पालक',emoji:'🌿'}].map(c => (
              <button key={c.name} onClick={() => setSelectedCrop(c.name)}
                className={`flex flex-col items-center py-2.5 px-1 rounded-2xl border-2 transition-all ${selectedCrop === c.name ? 'bg-[#2d6a3e] border-[#2d6a3e]' : 'bg-gray-50 border-gray-100'}`}>
                <span className="text-xl mb-1">{c.emoji}</span>
                <p className={`text-xs font-medium leading-tight text-center ${selectedCrop === c.name ? 'text-white' : 'text-gray-600'}`}>{c.hindi}</p>
              </button>
            ))}
          </div>

          {/* Direction */}
          <p className="text-xs text-gray-400 mb-2">अलर्ट कब मिले:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setDirection('above')}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${direction === 'above' ? 'bg-green-600 border-green-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
              📈 कीमत बढ़े
            </button>
            <button onClick={() => setDirection('below')}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${direction === 'below' ? 'bg-red-500 border-red-500 text-white' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
              📉 कीमत घटे
            </button>
          </div>

          {/* Price Input */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center bg-gray-50 rounded-2xl px-4 border-2 border-gray-100 focus-within:border-[#2d6a3e]">
              <span className="text-gray-400 font-semibold mr-2">₹</span>
              <input
                type="number"
                placeholder="लक्ष्य कीमत..."
                value={tp}
                onChange={e => setTp(e.target.value)}
                className="flex-1 py-3 bg-transparent outline-none text-sm text-gray-800"
              />
              <span className="text-gray-400 text-xs">/क्विंटल</span>
            </div>
            <button onClick={createAlert} disabled={!tp || parseFloat(tp) <= 0 || saving}
              className={`px-4 py-3 rounded-2xl font-semibold text-sm transition-all ${tp && parseFloat(tp) > 0 ? 'bg-[#2d6a3e] text-white active:scale-95' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'सेट करें'}
            </button>
          </div>

          {added && (
            <div className="flex items-center gap-2 bg-green-50 rounded-xl px-4 py-2.5">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs text-green-700 font-medium">✓ अलर्ट सेट हो गया! कीमत पर SMS आएगा।</p>
            </div>
          )}
        </div>

        {/* Best Day Alert Info */}
        <div className="bg-gradient-to-br from-[#fff7ed] to-white rounded-3xl p-5 border border-[#f97316]/20 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 bg-[#fff7ed] rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#f97316]" />
            </div>
            <div>
              <p className="font-semibold text-gray-800">AI पूर्वानुमान अलर्ट</p>
              <p className="text-xs text-gray-400">जल्द आ रहा है</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">AI अगले 7 दिनों में सबसे अच्छे दिन का अनुमान लगाएगा और उस दिन सुबह SMS भेजेगा।</p>
        </div>

        {/* My Alerts */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-[#2d6a3e]" />
            <p className="font-semibold text-gray-800">मेरे अलर्ट</p>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-[#2d6a3e]" />
            </div>
          )}

          {!loading && alerts.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">अभी कोई अलर्ट नहीं है</p>
          )}

          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-[#f0fdf4] rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{CROP_ICONS[a.crop] || '🌱'}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{CROP_HINDI[a.crop] || a.crop}</p>
                    <p className="text-xs text-gray-500">
                      {a.direction === 'above' ? 'जब कीमत' : 'जब कीमत'}{' '}
                      <span className={`font-bold ${a.direction === 'above' ? 'text-green-600' : 'text-red-500'}`}>
                        {a.direction === 'above' ? '≥' : '≤'} ₹{a.target_price}
                      </span>
                      {' '}पहुँचे
                    </p>
                    <p className="text-xs text-gray-400">{a.market}</p>
                  </div>
                </div>
                <button onClick={() => deleteAlert(a.id)}
                  className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
