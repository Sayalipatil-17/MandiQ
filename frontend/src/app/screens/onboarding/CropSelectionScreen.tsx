import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '../../../AuthContext';
import { mandiApi } from '../../../mandiq-api';
import { useT } from '../../../i18n';

import tomatoImg from '../../../assets/tomato.jpg';
import onionImg from '../../../assets/onion.jpg';
import potatoImg from '../../../assets/potato.jpg';
import spinachImg from '../../../assets/spinach.jpg';

const CROPS = [
  { name: 'Tomato', hindi: 'टमाटर', img: tomatoImg },
  { name: 'Potato', hindi: 'आलू', img: potatoImg },
  { name: 'Onion', hindi: 'प्याज', img: onionImg },
  { name: 'Spinach', hindi: 'पालक', img: spinachImg },
];

export function CropSelectionScreen() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [customCrops, setCustomCrops] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function toggle(name: string) {
    setSelected(s => s.includes(name) ? s.filter(x => x !== name) : [...s, name]);
  }

  function handleAddCustom() {
    const val = customInput.trim();
    if (!val) return;
    if (!customCrops.includes(val) && !selected.includes(val)) {
      setCustomCrops(c => [...c, val]);
    }
    setCustomInput('');
  }

  function handleRemoveCustom(val: string) {
    setCustomCrops(c => c.filter(x => x !== val));
  }

  async function handleSave() {
    setLoading(true);
    setError('');
    const allSelectedCrops = [...selected, ...customCrops];
    try {
      await mandiApi.completeProfile({
        name: localStorage.getItem('ob_name') || '',
        user_type: localStorage.getItem('ob_user_type') || 'farmer',
        state: localStorage.getItem('ob_state') || '',
        district: localStorage.getItem('ob_district') || '',
        village: localStorage.getItem('ob_village') || '',
        crops: allSelectedCrops,
        farm_size: farmSize,
      });
      
      // Clean temporary setup storage
      ['ob_name', 'ob_user_type', 'ob_state', 'ob_district', 'ob_village'].forEach(k => localStorage.removeItem(k));
      
      // Reload user profile in AuthContext
      await refreshUser();
      
      // Route to Home
      navigate('/home');
    } catch (e: any) {
      setError(e.message || 'Saving profile failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const hasCrops = selected.length > 0 || customCrops.length > 0;

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-12 pb-8 flex flex-col mq-fadein">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
          <ArrowLeft className="w-6 h-6 text-[#2d6a3e]" />
        </button>
        <span className="text-sm font-semibold text-gray-400">Step 6/6</span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1b4228]">{t('onboarding.whatCrops')}</h2>
        <p className="text-gray-500 mt-1 text-sm">{t('onboarding.cropsDesc')}</p>
      </div>

      {/* Grid Layout of Primary Crops with high-quality generated images */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {CROPS.map(c => {
          const isSel = selected.includes(c.name);
          return (
            <button
              key={c.name}
              onClick={() => toggle(c.name)}
              className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all flex flex-col justify-end p-3 ${
                isSel
                  ? 'border-[#2d6a3e] ring-4 ring-[#e8f5e9]'
                  : 'border-gray-100'
              }`}
            >
              <img
                src={c.img}
                alt={c.name}
                className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-300 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent z-10" />
              <div className="relative z-20 text-left text-white">
                <p className="font-bold text-lg">{t(`crops.${c.name.toLowerCase()}`)}</p>
                <p className="text-xs text-white/80">{c.name}</p>
              </div>
              {isSel && (
                <div className="absolute top-2 right-2 z-20 bg-[#2d6a3e] text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">
                  ✓
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Crop input field */}
      <div className="space-y-3 mb-6 bg-gray-50 p-4 rounded-2xl">
        <label className="text-sm font-bold text-gray-700">{t('onboarding.otherCrops')}</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('onboarding.otherCropsPlaceholder')}
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
            className="flex-1 px-4 h-12 rounded-xl bg-white border border-gray-200 outline-none text-sm focus:border-[#2d6a3e]"
          />
          <button
            onClick={handleAddCustom}
            className="w-12 h-12 bg-[#2d6a3e] hover:bg-[#1b4228] text-white rounded-xl flex items-center justify-center transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Display added custom crops list */}
        {customCrops.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {customCrops.map(c => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e8f5e9] text-[#2d6a3e] rounded-full text-xs font-bold"
              >
                {c}
                <button onClick={() => handleRemoveCustom(c)}>
                  <X className="w-3.5 h-3.5 hover:text-red-500" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Farm size input field */}
      <div className="space-y-2 mb-6">
        <label className="text-sm font-bold text-[#1b4228]">{t('onboarding.farmSizeLabel')}</label>
        <input
          type="number"
          placeholder={t('onboarding.farmSizePlaceholder')}
          value={farmSize}
          onChange={e => setFarmSize(e.target.value)}
          className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-base font-semibold"
        />
      </div>

      {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}

      <button
        onClick={handleSave}
        disabled={!hasCrops || loading}
        className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 mt-auto shadow-md ${
          hasCrops ? 'bg-[#2d6a3e] hover:bg-[#1b4228] transition-colors' : 'bg-gray-200 cursor-not-allowed'
        }`}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${t('onboarding.startApp')} 🚀`}
      </button>
    </div>
  );
}
export default CropSelectionScreen;
