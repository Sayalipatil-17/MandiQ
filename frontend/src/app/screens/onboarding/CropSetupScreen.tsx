import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CROPS = [
  { name: 'Tomato', hindi: 'टमाटर', emoji: '🍅' },
  { name: 'Potato', hindi: 'आलू', emoji: '🥔' },
  { name: 'Onion', hindi: 'प्याज', emoji: '🧅' },
  { name: 'Spinach', hindi: 'पालक', emoji: '🌿' },
];

export function CropSetupScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggle(name: string) {
    setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);
  }

  async function handleSave() {
    setLoading(true);
    try {
      const token = localStorage.getItem('mandiq_token');
      await fetch(`${BASE_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: localStorage.getItem('ob_name') || '',
          user_type: localStorage.getItem('ob_user_type') || 'farmer',
          state: localStorage.getItem('ob_state') || '',
          district: localStorage.getItem('ob_district') || '',
          crops: selected,
        }),
      });
      ['ob_name', 'ob_user_type', 'ob_state', 'ob_district'].forEach(k => localStorage.removeItem(k));
      navigate('/home');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-16 pb-8">
      <button onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="w-6 h-6 text-[#2d6a3e]" />
      </button>
      <p className="text-xs text-gray-400 mb-6">Step 4/4</p>
      <h2 className="text-2xl font-bold text-[#1b4228] mb-2">आपकी फसलें कौन सी हैं?</h2>
      <p className="text-gray-500 mb-8">एक या अधिक चुनें</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {CROPS.map(c => {
          const isSel = selected.includes(c.name);
          return (
            <button key={c.name} onClick={() => toggle(c.name)}
              className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${isSel ? 'bg-[#e8f5e9] border-[#2d6a3e]' : 'bg-gray-50 border-gray-100'}`}>
              <span className="text-4xl">{c.emoji}</span>
              <p className={`font-semibold ${isSel ? 'text-[#2d6a3e]' : 'text-gray-700'}`}>{c.hindi}</p>
              <p className="text-xs text-gray-400">{c.name}</p>
            </button>
          );
        })}
      </div>

      <button onClick={handleSave} disabled={selected.length === 0 || loading}
        className={`w-full h-14 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 ${selected.length > 0 ? 'bg-[#2d6a3e]' : 'bg-gray-200 cursor-not-allowed'}`}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'MandiQ शुरू करें 🚀'}
      </button>
    </div>
  );
}