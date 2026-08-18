import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { useT } from '../../../i18n';

const STATES = [
  'Delhi', 'Haryana', 'Punjab', 'Uttar Pradesh', 'Rajasthan', 
  'Madhya Pradesh', 'Maharashtra', 'Gujarat', 'Bihar', 'Karnataka'
];

export function LocationScreen() {
  const navigate = useNavigate();
  const { t } = useT();
  const [state, setState] = useState(localStorage.getItem('ob_state') || '');
  const [district, setDistrict] = useState(localStorage.getItem('ob_district') || '');
  const [village, setVillage] = useState(localStorage.getItem('ob_village') || '');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');

  async function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      setGpsError(t('onboarding.gpsError.unsupported'));
      return;
    }

    setGpsLoading(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            
            // Extract state and district (openstreetmap uses county or state_district or city)
            const detectedState = addr.state || '';
            const detectedDistrict = addr.county || addr.state_district || addr.city || '';
            const detectedVillage = addr.village || addr.suburb || addr.neighbourhood || '';

            // Find closest matching state from our list
            const matchedState = STATES.find(s => 
              detectedState.toLowerCase().includes(s.toLowerCase())
            ) || detectedState;

            if (matchedState) setState(matchedState);
            if (detectedDistrict) setDistrict(detectedDistrict.replace(/district/gi, '').trim());
            if (detectedVillage) setVillage(detectedVillage);
          } else {
            setGpsError(t('onboarding.gpsError.fetchFailed'));
          }
        } catch {
          setGpsError(t('onboarding.gpsError.network'));
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        setGpsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError(t('onboarding.gpsError.denied'));
            break;
          default:
            setGpsError(t('onboarding.gpsError.weak'));
        }
      },
      { timeout: 10000 }
    );
  }

  function handleNext() {
    if (!state || !district) return;
    localStorage.setItem('ob_state', state);
    localStorage.setItem('ob_district', district);
    localStorage.setItem('ob_village', village);
    navigate('/onboarding/crops');
  }

  const isValid = state.trim().length > 0 && district.trim().length > 0;

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-12 pb-8 flex flex-col mq-fadein">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/onboarding/name')} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
          <ArrowLeft className="w-6 h-6 text-[#2d6a3e]" />
        </button>
        <span className="text-sm font-semibold text-gray-400">Step 5/6</span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1b4228]">{t('onboarding.whereAreYou')}</h2>
        <p className="text-gray-500 mt-1">{t('onboarding.locationDesc')}</p>
      </div>

      <div className="space-y-6 flex-1">
        {/* GPS location fetch button */}
        <button
          onClick={handleGetCurrentLocation}
          disabled={gpsLoading}
          type="button"
          className="w-full h-14 bg-[#e8f5e9] hover:bg-[#c8e6c9] text-[#2d6a3e] rounded-2xl font-extrabold flex items-center justify-center gap-3 transition-colors border-2 border-dashed border-[#2d6a3e]/30 shadow-sm"
        >
          {gpsLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <MapPin className="w-5 h-5" />
          )}
          {gpsLoading ? t('onboarding.gpsSearching') : t('onboarding.gpsBtn')}
        </button>

        {gpsError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl p-2.5 text-center font-medium">
            ⚠️ {gpsError}
          </p>
        )}

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-xs font-bold text-gray-300 uppercase">{t('onboarding.manualSelect')}</span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Manual dropdown forms */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">{t('profile.editState')} *</label>
            <select
              value={state}
              onChange={e => setState(e.target.value)}
              className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-base font-bold text-gray-700 focus:bg-white"
            >
              <option value="">{t('onboarding.selectState')}</option>
              {STATES.map(s => (
                <option key={s} value={s}>{t('state.' + s.toLowerCase().replace(/ /g, ''))}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">{t('profile.editDistrict')} *</label>
            <input
              type="text"
              placeholder={t('onboarding.districtPlaceholder')}
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-base font-bold text-gray-700 focus:bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">{t('onboarding.villageLabel')}</label>
            <input
              type="text"
              placeholder={t('onboarding.villagePlaceholder')}
              value={village}
              onChange={e => setVillage(e.target.value)}
              className="w-full px-4 h-14 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-base font-bold text-gray-700 focus:bg-white"
            />
          </div>
        </div>
      </div>

      <button
        onClick={handleNext}
        disabled={!isValid || gpsLoading}
        className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 mt-8 shadow-md transition-colors ${
          isValid ? 'bg-[#2d6a3e] hover:bg-[#1b4228]' : 'bg-gray-200 cursor-not-allowed'
        }`}
      >
        {t('common.continue')} →
      </button>
    </div>
  );
}
export default LocationScreen;