import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sprout, Phone, Loader2 } from 'lucide-react';
import { mandiApi } from '../../mandiq-api';
import { useT } from '../../i18n';
import { useAuth } from '../../AuthContext';

export function LoginScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const { t } = useT();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated || token || localStorage.getItem('mandiq_token')) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, token, navigate]);

  async function handleSendOtp() {
    setLoading(true);
    setError('');
    try {
      const res = await mandiApi.sendOtp(phone);
      // Navigate to OTP screen and pass the phone and generated dev OTP
      navigate('/otp', { state: { mobile: phone, testingOtp: res.testing_otp } });
    } catch (e: any) {
      setError(e.message || t('login.otpSendError'));
    } finally {
      setLoading(false);
    }
  }

  const isValid = phone.length === 10;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8f5e9] via-white to-white flex flex-col max-w-md mx-auto px-6 pt-16 mq-fadein">
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-[#2d6a3e] to-[#1b4228] rounded-3xl flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 32px rgba(45,106,62,0.3)' }}>
          <Sprout className="w-11 h-11 text-white" />
        </div>
      </div>

      <div className="mb-8 text-center">
        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">Step 1/6</span>
        <h2 className="text-3xl font-extrabold text-[#1b4228] mt-3">{t('login.namaste')}</h2>
        <p className="text-gray-500 mt-1">{t('login.enterMobile')}</p>
      </div>

      <div className="space-y-6">
        <div className="mq-input flex items-center px-4 h-14 gap-2 border-2 border-gray-100 focus-within:border-[#2d6a3e] rounded-2xl bg-gray-50/50">
          <Phone className="w-5 h-5 text-gray-400" />
          <span className="text-gray-500 font-bold text-base">+91</span>
          <span className="text-gray-200 mx-1">|</span>
          <input
            type="tel"
            placeholder="98765 43210"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="flex-1 bg-transparent outline-none text-lg font-bold tracking-wide placeholder-gray-300"
          />
        </div>

        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

        <button
          onClick={handleSendOtp}
          disabled={!isValid || loading}
          className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 shadow-md transition-colors ${
            isValid ? 'bg-[#2d6a3e] hover:bg-[#1b4228]' : 'bg-gray-200 cursor-not-allowed'
          }`}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.sendOtp')}
        </button>
      </div>
    </div>
  );
}
export default LoginScreen;
