import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sprout, Phone, Loader2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LoginScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState<'phone'|'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSendOtp() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setStep('otp');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp() {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      login(data.token, data.user);
      if (data.is_new_user) navigate('/onboarding/user-type');
      else navigate('/home');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8f5e9] via-white to-white flex flex-col max-w-md mx-auto px-6 pt-16">
      <div className="flex justify-center mb-8">
        <div className="w-16 h-16 bg-[#2d6a3e] rounded-2xl flex items-center justify-center">
          <Sprout className="w-9 h-9 text-white" />
        </div>
      </div>

      {step === 'phone' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1b4228]">नमस्ते! 🙏</h2>
            <p className="text-gray-500 mt-1">अपना मोबाइल नंबर डालें</p>
          </div>
          <div className="flex items-center bg-white border-2 border-gray-100 focus-within:border-[#2d6a3e] rounded-2xl px-4 h-14 gap-2">
            <Phone className="w-5 h-5 text-gray-400" />
            <span className="text-gray-500 font-medium">+91</span>
            <span className="text-gray-200 mx-1">|</span>
            <input type="tel" placeholder="मोबाइल नंबर" value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
              className="flex-1 outline-none text-base" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleSendOtp} disabled={phone.length!==10||loading}
            className={`w-full h-14 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 ${phone.length===10?'bg-[#2d6a3e]':'bg-gray-200 cursor-not-allowed'}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'OTP भेजें'}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1b4228]">OTP डालें</h2>
            <p className="text-gray-500 mt-1">+91 {phone} पर भेजा गया</p>
          </div>
          <input type="number" placeholder="6 अंकों का OTP" value={otp}
            onChange={e => setOtp(e.target.value.slice(0,6))}
            className="w-full px-4 h-14 rounded-2xl bg-white border-2 border-gray-100 focus:border-[#2d6a3e] outline-none text-center text-2xl font-bold tracking-widest" />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button onClick={handleVerifyOtp} disabled={otp.length!==6||loading}
            className={`w-full h-14 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 ${otp.length===6?'bg-[#2d6a3e]':'bg-gray-200 cursor-not-allowed'}`}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'OTP जाँचें'}
          </button>
          <button onClick={() => { setStep('phone'); setOtp(''); }} className="w-full text-sm text-[#2d6a3e]">
            ← वापस जाएं
          </button>
        </div>
      )}
    </div>
  );
}