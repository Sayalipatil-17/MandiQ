import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sprout, Phone, Loader2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useT } from '../../i18n';

// ── TEMPORARY: Firebase disabled for UI preview ──
// To restore: git checkout frontend/src/app/screens/LoginScreen.tsx

export function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useT();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp() {
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 600));
    setStep('otp');
    setLoading(false);
  }

  async function handleVerifyOtp() {
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 600));
    if (otp !== '123456') {
      setError('Demo mode: OTP must be 123456');
      setLoading(false);
      return;
    }
    login('demo-token', {
      id: 1,
      name: 'Demo User',
      mobile: `+91${phone}`,
      role: 'farmer',
      farmer_details: { state: 'Delhi', district: 'North Delhi', crops: ['Tomato'] },
    });
    navigate('/home');
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8f5e9] via-white to-white flex flex-col max-w-md mx-auto px-6 pt-16 mq-fadein">
      <div className="flex justify-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-[#2d6a3e] to-[#1b4228] rounded-3xl flex items-center justify-center shadow-lg" style={{ boxShadow: '0 8px 32px rgba(45,106,62,0.3)' }}>
          <Sprout className="w-11 h-11 text-white" />
        </div>
      </div>

      {/* Demo banner */}
      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-2.5 text-center">
        <p className="text-xs text-yellow-700 font-medium">🚧 Demo Mode — OTP: <strong>123456</strong></p>
      </div>

      {step === 'phone' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1b4228]">{t('login.namaste')}</h2>
            <p className="text-gray-500 mt-1">{t('login.enterMobile')}</p>
          </div>
          <div className="mq-input flex items-center px-4 h-14 gap-2">
            <Phone className="w-5 h-5 text-gray-400" />
            <span className="text-gray-500 font-medium">+91</span>
            <span className="text-gray-200 mx-1">|</span>
            <input type="tel" placeholder={t('login.mobilePlaceholder')} value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 outline-none text-base" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleSendOtp} disabled={phone.length !== 10 || loading}
            className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 ${phone.length === 10 ? 'mq-cta' : 'bg-gray-200 cursor-not-allowed'}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.sendOtp')}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1b4228]">{t('login.enterOtp')}</h2>
            <p className="text-gray-500 mt-1">+91 {phone} {t('login.sentTo')}</p>
          </div>
          <input type="number" placeholder={t('login.otpPlaceholder')} value={otp}
            onChange={e => setOtp(e.target.value.slice(0, 6))}
            className="w-full px-4 h-14 rounded-2xl bg-white border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-center text-2xl font-bold tracking-widest" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleVerifyOtp} disabled={otp.length !== 6 || loading}
            className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 ${otp.length === 6 ? 'mq-cta' : 'bg-gray-200 cursor-not-allowed'}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.verifyOtp')}
          </button>
          <button onClick={() => { setStep('phone'); setOtp(''); }} className="w-full text-sm text-[#2d6a3e]">
            {t('common.back')}
          </button>
        </div>
      )}
    </div>
  );
}
