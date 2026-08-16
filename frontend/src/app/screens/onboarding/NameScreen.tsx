import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../../../i18n';

export function NameScreen() {
  const navigate = useNavigate();
  const { t } = useT();
  const [name, setName] = useState(localStorage.getItem('ob_name') || '');

  function handleNext() {
    if (name.trim().length < 2) return;
    localStorage.setItem('ob_name', name.trim());
    navigate('/onboarding/location');
  }

  const isValid = name.trim().length >= 2;

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-12 flex flex-col mq-fadein">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/onboarding/user-type')} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
          <ArrowLeft className="w-6 h-6 text-[#2d6a3e]" />
        </button>
        <span className="text-sm font-semibold text-gray-400">Step 4/6</span>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b4228]">{t('onboarding.whatName')}</h2>
        <p className="text-gray-500 mt-1">{t('onboarding.writeName')}</p>
      </div>

      <div className="space-y-6">
        <input
          type="text"
          placeholder={t('onboarding.namePlaceholder')}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && isValid && handleNext()}
          className="w-full px-5 h-16 rounded-2xl bg-gray-50 border-2 border-gray-100 focus:border-[#2d6a3e] focus:bg-white outline-none text-xl font-bold text-gray-800 transition-all focus:ring-4 focus:ring-[#e8f5e9]"
        />

        <button
          onClick={handleNext}
          disabled={!isValid}
          className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-md transition-colors ${
            isValid ? 'bg-[#2d6a3e] hover:bg-[#1b4228]' : 'bg-gray-200 cursor-not-allowed'
          }`}
        >
          {t('common.continue')} →
        </button>
      </div>
    </div>
  );
}
export default NameScreen;