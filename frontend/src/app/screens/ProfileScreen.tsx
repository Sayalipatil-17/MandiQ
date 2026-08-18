import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Globe, MapPin, Leaf, LogOut, Info, Star, X, Pencil, Check, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { SupportChat } from '../components/SupportChat';
import { useT, type Lang, cropName } from '../../i18n';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const CROP_ICONS: Record<string, string> = { Tomato: '🍅', Potato: '🥔', Onion: '🧅', Spinach: '🌿' };
const ALL_CROPS = ['Tomato', 'Potato', 'Onion', 'Spinach'];
const STARS = [1, 2, 3, 4, 5];

export function ProfileScreen() {
  const nav = useNavigate();
  const { t, lang, setLang } = useT();
  const [user, setUser] = useState<any>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [alreadyRated, setAlreadyRated] = useState(() => localStorage.getItem('mandiq_rated') === 'true');
  const [rated, setRated] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('farmer');
  const [editState, setEditState] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editCrops, setEditCrops] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

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
    }).then(r => r.json()).then(data => {
      setUser(data);
      const fd = data?.farmer_details
        ? (typeof data.farmer_details === 'string' ? JSON.parse(data.farmer_details) : data.farmer_details)
        : {};
      setEditName(data?.name || '');
      setEditRole(data?.user_type || 'farmer');
      setEditState(fd?.state || '');
      setEditDistrict(fd?.district || '');
      setEditCrops(fd?.crops || []);
    }).catch(console.error);
  }, []);

  const farmerDetails = user?.farmer_details
    ? (typeof user.farmer_details === 'string' ? JSON.parse(user.farmer_details) : user.farmer_details)
    : {};
  const crops = farmerDetails?.crops || [];

  function handleLogout() {
    localStorage.removeItem('mandiq_token');
    localStorage.removeItem('mandiq_user');
    nav('/login');
  }

  function openEdit() {
    const fd = user?.farmer_details
      ? (typeof user.farmer_details === 'string' ? JSON.parse(user.farmer_details) : user.farmer_details)
      : {};
    setEditName(user?.name || '');
    setEditRole(user?.user_type || 'farmer');
    setEditState(fd?.state || '');
    setEditDistrict(fd?.district || '');
    setEditCrops(fd?.crops || []);
    setSaveMsg('');
    setShowEdit(true);
  }

  function toggleCrop(c: string) {
    setEditCrops(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg('');
    try {
      const token = localStorage.getItem('mandiq_token');
      const res = await fetch(`${BASE_URL}/api/auth/complete-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName,
          user_type: editRole,
          state: editState,
          district: editDistrict,
          village: farmerDetails?.village || '',
          crops: editCrops,
          farm_size: farmerDetails?.farm_size || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSaveMsg(t('profile.saved'));
        setTimeout(() => setShowEdit(false), 900);
      }
    } catch {
      setSaveMsg('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f4] pb-20 max-w-md mx-auto mq-fadein">
      {/* Header */}
      <div className="mq-header px-6 py-8 rounded-b-[2.5rem]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/40">
              <img src="/farmer-avatar.svg" alt="kisan" className="w-full h-full object-cover" />
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{user?.name || 'Namaste'}</h2>
              <p className="text-white/80 text-sm">{user?.user_type === 'farmer' ? `🌾 ${t('profile.farmer')}` : `🏪 ${t('profile.trader')}`}</p>
              <p className="text-white/70 text-sm">+91 {user?.mobile_number || user?.mobile || ''}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={openEdit} className="p-2 bg-white/20 rounded-xl" title={t('profile.edit')}>
              <Pencil className="w-5 h-5 text-white" />
            </button>
            <button onClick={handleLogout} className="p-2 bg-white/20 rounded-xl">
              <LogOut className="w-5 h-5 text-white" />
            </button>
          </div>
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
              <p className="font-semibold text-gray-800">{t('profile.myCrops')}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {crops.map((c: string) => (
                <span key={c} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f5e9] rounded-xl text-sm text-[#2d6a3e] font-medium">
                  {CROP_ICONS[c] || '🌱'} {cropName(c, t)}
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
        <button onClick={() => setShowAbout(true)}
          className="w-full bg-[#f0f7f1] rounded-2xl p-5 border border-[#2d6a3e]/15 flex items-center justify-between transition-all active:scale-95">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-[#2d6a3e] rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">{t('profile.about')}</p>
              <p className="text-xs text-gray-400">{t('profile.aboutSub')}</p>
            </div>
          </div>
          <span className="text-xs text-[#2d6a3e] font-semibold flex items-center gap-1">
            {t('home.viewBtn')}
          </span>
        </button>

        {/* Rate & Feedback section */}
        {!alreadyRated && (
          <div id="rate-section" className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
            {!rated ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-[#f97316]" />
                  <p className="font-semibold text-gray-800">{t('profile.rateTitle')}</p>
                </div>
                <div className="flex gap-2 justify-center mb-4">
                  {STARS.map(s => (
                    <button key={s}
                      onMouseEnter={() => rating === 0 && setHovered(s)}
                      onMouseLeave={() => rating === 0 && setHovered(0)}
                      onClick={() => { setRating(s); setHovered(0); }}
                      className="text-3xl transition-transform active:scale-90">
                      <span style={{ color: s <= (rating || hovered) ? '#f97316' : '#e5e7eb' }}>★</span>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <div className="space-y-3">
                    <textarea
                      value={feedback}
                      onChange={e => setFeedback(e.target.value)}
                      placeholder={t('profile.feedbackPh')}
                      rows={3}
                      className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-[#2d6a3e] resize-none"
                    />
                    <button
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('mandiq_token');
                          await fetch(`${BASE_URL}/api/rating`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ stars: rating, feedback }),
                          });
                        } catch { }
                        localStorage.setItem('mandiq_rated', 'true');
                        setRated(true);
                      }}
                      className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                      style={{ background: '#f97316' }}>
                      {t('profile.submitFeedback')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-3xl mb-2">🙏</p>
                <p className="font-semibold text-gray-800">{t('profile.thanks')}</p>
                <p className="text-sm text-gray-400 mt-1">{t('profile.thanksMsg')}</p>
                <div className="flex justify-center gap-1 mt-3">
                  {STARS.map(s => (
                    <span key={s} style={{ color: s <= rating ? '#f97316' : '#e5e7eb', fontSize: '20px' }}>★</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
      <BottomNav />
      <SupportChat />

      {/* ── Edit Profile Modal ─────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowEdit(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl pb-10 overflow-y-auto" style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-800 text-lg">{t('profile.edit')}</p>
              <button onClick={() => setShowEdit(false)} className="p-2 rounded-xl bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="px-6 pt-4 space-y-5">

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('profile.editName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder={t('profile.namePh')}
                  className="mt-2 w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-[#2d6a3e] bg-gray-50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('profile.editRole')}</label>
                <div className="mt-2 flex gap-3">
                  <button onClick={() => setEditRole('farmer')}
                    className={`flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${editRole === 'farmer' ? 'bg-[#2d6a3e] border-[#2d6a3e] text-white' : 'border-gray-200 text-gray-600'}`}>
                    🌾 {t('profile.farmer')}
                  </button>
                  <button onClick={() => setEditRole('trader')}
                    className={`flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${editRole === 'trader' ? 'bg-[#f97316] border-[#f97316] text-white' : 'border-gray-200 text-gray-600'}`}>
                    🏪 {t('profile.trader')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('profile.editState')}</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={e => setEditState(e.target.value)}
                    placeholder={t('profile.statePh')}
                    className="mt-2 w-full px-3 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-[#2d6a3e] bg-gray-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('profile.editDistrict')}</label>
                  <input
                    type="text"
                    value={editDistrict}
                    onChange={e => setEditDistrict(e.target.value)}
                    placeholder={t('profile.districtPh')}
                    className="mt-2 w-full px-3 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-[#2d6a3e] bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('profile.editCrops')}</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ALL_CROPS.map(c => {
                    const selected = editCrops.includes(c);
                    return (
                      <button key={c} onClick={() => toggleCrop(c)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${selected ? 'bg-[#e8f5e9] border-[#2d6a3e] text-[#2d6a3e]' : 'border-gray-200 text-gray-600'}`}>
                        <span className="text-lg">{CROP_ICONS[c]}</span>
                        {cropName(c, t)}
                        {selected && <Check className="w-4 h-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {saveMsg && (
                <p className="text-center text-sm font-semibold text-[#2d6a3e]">{saveMsg}</p>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 mb-2"
                style={{ background: saving ? '#86b898' : '#2d6a3e' }}>
                {saving
                  ? <><Loader2 className="w-5 h-5 animate-spin" />{t('profile.saving')}</>
                  : t('profile.save')}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* ── About MandiQ Modal ─────────────────────────────────────── */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setShowAbout(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6 pb-10"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden">
                  <img src="/farmer-avatar.svg" alt="MandiQ" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-lg">MandiQ</p>
                  <p className="text-xs text-gray-400">{t('profile.version')}</p>
                </div>
              </div>
              <button onClick={() => setShowAbout(false)} className="p-2 rounded-xl bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed">{t('profile.aboutDesc')}</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-[#f0f7f1] rounded-2xl px-4 py-3">
                <span className="text-xl">🌾</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('profile.f1title')}</p>
                  <p className="text-xs text-gray-400">{t('profile.f1sub')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#fff7ed] rounded-2xl px-4 py-3">
                <span className="text-xl">📊</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('profile.f2title')}</p>
                  <p className="text-xs text-gray-400">{t('profile.f2sub')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#f0f7f1] rounded-2xl px-4 py-3">
                <span className="text-xl">🔔</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('profile.f3title')}</p>
                  <p className="text-xs text-gray-400">{t('profile.f3sub')}</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-center text-gray-400 mt-6">{t('profile.madeWith')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
