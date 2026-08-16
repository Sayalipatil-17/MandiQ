import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { mandiApi } from '../../mandiq-api';
import { useT } from '../../i18n';

export function OtpScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { t } = useT();
  const { mobile, testingOtp } = (location.state as { mobile: string; testingOtp?: string }) || { mobile: '' };

  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [currentTestingOtp, setCurrentTestingOtp] = useState(testingOtp);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Geolocation trigger timer
  useEffect(() => {
    if (!mobile) {
      navigate('/login');
      return;
    }

    const interval = setInterval(() => {
      setTimer(t => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [mobile, navigate]);

  function handleChange(value: string, index: number) {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next input box
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError('');
    const fullOtp = otp.join('');
    try {
      const res = await mandiApi.verifyOtp(mobile, fullOtp);
      
      // Save token to localStorage & update auth context
      login(res.token, res.user);

      if (res.is_new_user) {
        // Redirect to Onboarding step 3
        navigate('/onboarding/user-type');
      } else {
        // Existing user: Directly redirect to Home
        navigate('/home');
      }
    } catch (e: any) {
      setError(e.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    try {
      const res = await mandiApi.sendOtp(mobile);
      setTimer(30);
      setOtp(Array(6).fill(''));
      if (res.testing_otp) {
        setCurrentTestingOtp(res.testing_otp);
      }
    } catch (e: any) {
      setError('Resending OTP failed. Try again.');
    } finally {
      setResending(false);
    }
  }

  const isComplete = otp.every(val => val !== '');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#e8f5e9] via-white to-white flex flex-col max-w-md mx-auto px-6 pt-12 mq-fadein">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/login')} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-6 h-6 text-[#2d6a3e]" />
        </button>
        <span className="text-sm font-semibold text-gray-400">Step 2/6</span>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#1b4228]">{t('login.verifyHeader')}</h2>
        <p className="text-gray-500 mt-1">{t('login.otpSentMsg').replace('{mobile}', mobile)}</p>
      </div>


      {/* 6 Large inputs grid */}
      <div className="grid grid-cols-6 gap-2 mb-6">
        {otp.map((val, idx) => (
          <input
            key={idx}
            type="text"
            pattern="[0-9]*"
            inputMode="numeric"
            maxLength={1}
            ref={el => { inputsRef.current[idx] = el; }}
            value={val}
            onChange={e => handleChange(e.target.value, idx)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className="aspect-square w-full rounded-2xl border-2 border-gray-100 focus:border-[#2d6a3e] bg-gray-50/50 focus:bg-white text-center text-2xl font-bold outline-none transition-all focus:ring-4 focus:ring-[#e8f5e9]"
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-6 text-center font-medium">{error}</p>}

      <button
        onClick={handleVerify}
        disabled={!isComplete || loading}
        className={`w-full h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 mb-6 shadow-md ${
          isComplete ? 'bg-[#2d6a3e] hover:bg-[#1b4228] transition-colors' : 'bg-gray-200 cursor-not-allowed'
        }`}
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('login.verifyBtn')}
      </button>

      {/* Resend OTP timer controls */}
      <div className="text-center mt-4">
        {timer > 0 ? (
          <p className="text-sm text-gray-500">
            {t('login.resendTimerText').replace('{timer}', timer.toString())}
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="inline-flex items-center gap-1 text-sm font-bold text-[#2d6a3e] hover:underline"
          >
            <RotateCcw className="w-4 h-4" />
            {t('login.resendBtn')}
          </button>
        )}
      </div>
    </div>
  );
}
export default OtpScreen;
