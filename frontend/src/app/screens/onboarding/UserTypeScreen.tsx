import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../../../i18n';

export function UserTypeScreen() {
  const navigate = useNavigate();
  const { t } = useT();

  function selectRole(role: string) {
    localStorage.setItem('ob_user_type', role);
    navigate('/onboarding/name');
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-6 pt-12 flex flex-col mq-fadein">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/otp')} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
          <ArrowLeft className="w-6 h-6 text-[#2d6a3e]" />
        </button>
        <span className="text-sm font-semibold text-gray-400">Step 3/6</span>
      </div>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b4228]">{t('onboarding.whoAreYou')}</h2>
        <p className="text-gray-500 mt-1">{t('onboarding.selectRole')}</p>
      </div>

      <div className="space-y-6">
        <button
          onClick={() => selectRole('farmer')}
          className="w-full p-6 rounded-2xl border-2 border-gray-100 hover:border-[#2d6a3e] hover:bg-[#e8f5e9]/10 bg-white flex items-center gap-5 transition-all text-left shadow-sm focus:ring-4 focus:ring-[#e8f5e9]"
        >
          <div className="w-16 h-16 bg-[#e8f5e9] rounded-2xl flex items-center justify-center text-4xl shadow-inner">🌾</div>
          <div>
            <p className="font-extrabold text-xl text-gray-800">{t('login.farmer')}</p>
            <p className="text-sm text-gray-400 mt-0.5">{t('onboarding.farmerDesc')}</p>
          </div>
        </button>

        <button
          onClick={() => selectRole('trader')}
          className="w-full p-6 rounded-2xl border-2 border-gray-100 hover:border-[#2d6a3e] hover:bg-[#e8f5e9]/10 bg-white flex items-center gap-5 transition-all text-left shadow-sm focus:ring-4 focus:ring-[#e8f5e9]"
        >
          <div className="w-16 h-16 bg-[#fff3e0] rounded-2xl flex items-center justify-center text-4xl shadow-inner">🏪</div>
          <div>
            <p className="font-extrabold text-xl text-gray-800">{t('login.trader')}</p>
            <p className="text-sm text-gray-400 mt-0.5">{t('onboarding.traderDesc')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
export default UserTypeScreen;