import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { User, Globe, MessageCircle, Mic, MapPin, Leaf, LogOut } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { useT, type Lang } from '../../i18n';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };

export function ProfileScreen() {
  const nav = useNavigate();
  const { t, lang, setLang } = useT();
  const [user, setUser] = useState<any>(null);

  const langs: { code: Lang; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
    { code: 'mr', label: 'मराठी' },
  ];

  useEffect(() => {
    const token = localStorage.getItem('mandiq_token');
    if (!token) return;
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(setUser).catch(console.error);
  }, []);

const farmerDetails = user?.farmer_details ? 
    (typeof user.farmer_details === 'string' ? JSON.parse(user.farmer_details) : user.farmer_details) : {};
  const crops = farmerDetails?.crops || [];

  function handleLogout() {
    localStorage.removeItem('mandiq_token');
    localStorage.removeItem('mandiq_user');
    nav('/login');
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-20 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#2d6a3e] to-[#16a34a] px-6 py-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/40">
              <img src="/kisan.png" alt="kisan" className="w-full h-full object-cover" />
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{user?.name || 'Namaste'}</h2>
              <p className="text-white/80 text-sm">{user?.role === 'farmer' ? '🌾 किसान' : '🏪 व्यापारी'}</p>
              <p className="text-white/70 text-sm">+91 {user?.mobile_number || user?.mobile || ''}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-white/20 rounded-xl">
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Location */}
        {(farmerDetails?.state || farmerDetails?.district) && (
          <div className="bg-white/15 rounded-2xl px-4 py-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-white/80" />
            <p className="text-white text-sm">{farmerDetails?.district}{farmerDetails?.district && farmerDetails?.state ? ', ' : ''}{farmerDetails?.state}</p>
          </div>
        )}
      </div>

      <div className="px-6 py-4 space-y-4">

        {/* Crops */}
        {crops.length > 0 && (
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Leaf className="w-5 h-5 text-[#2d6a3e]" />
              <p className="font-semibold text-gray-800">मेरी फसलें</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {crops.map((c: string) => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f5e9] rounded-xl text-sm text-[#2d6a3e] font-medium">
                  {CROP_ICONS[c] || '🌱'} {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Language */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-[#2d6a3e]" />
            <p className="font-semibold text-gray-800">{t('profile.language')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {langs.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`py-2.5 px-3 rounded-xl text-sm border-2 transition-all font-medium ${lang === l.code ? 'bg-[#2d6a3e] border-[#2d6a3e] text-white' : 'border-gray-100 text-gray-600'}`}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button className="bg-gradient-to-br from-[#fff7ed] to-white rounded-2xl p-5 border border-[#f97316]/20 flex flex-col items-start gap-3">
            <div className="w-11 h-11 bg-[#f97316] rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-medium text-gray-800">{t('profile.support')}</p>
          </button>
          <button className="bg-gradient-to-br from-[#fff7ed] to-white rounded-2xl p-5 border border-[#f97316]/20 flex flex-col items-start gap-3">
            <div className="w-11 h-11 bg-[#f97316] rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <p className="text-sm font-medium text-gray-800">{t('profile.voice')}</p>
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}