import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Sprout, ChevronRight } from 'lucide-react';
import { useT, type Lang } from '../../i18n';
import { useAuth } from '../../AuthContext';
import bgImage from '../../assets/mandiq-bg.png';

const BG_IMAGE = bgImage;

export function SplashScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const { lang, setLang, t } = useT();

  useEffect(() => {
    if (isAuthenticated || token || localStorage.getItem('mandiq_token')) {
      navigate('/home', { replace: true });
    }
  }, [isAuthenticated, token, navigate]);

  const languages: { code: Lang; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
    { code: 'mr', label: 'मराठी' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col max-w-md mx-auto overflow-hidden mq-fadein">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#1b4228]/60 to-[#1b4228]/90" />

      <div className="relative z-10 flex flex-col items-center justify-between min-h-screen p-6">
        <div className="flex-1 flex flex-col items-center justify-center pt-12">
          {/* Logo */}
          <div className="w-28 h-28 bg-white/15 backdrop-blur-sm rounded-[2rem] flex items-center justify-center mb-6 border border-white/25"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.2)' }}>
            <Sprout className="w-16 h-16 text-white" strokeWidth={2} />
          </div>

          <h1 className="text-6xl mb-2 font-extrabold tracking-tight" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.3)' }}>
            <span className="text-white">Mandi</span><span className="text-[#4ade80]">Q</span>
          </h1>

          <p className="text-base text-white/80 mb-2 tracking-wide">
            {t('app.tagline')}
          </p>

          <p className="text-center text-white/60 max-w-[260px] text-sm leading-relaxed">
            {t('app.subtitle')}
          </p>
        </div>

        <div className="w-full mb-6">
          <p className="text-xs mb-3 text-center text-white/60 font-medium tracking-widest uppercase">
            {t('common.selectLang')}
          </p>

          <div className="grid grid-cols-2 gap-2.5 mb-5">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`py-3 px-4 rounded-2xl border-2 transition-all font-semibold text-sm ${
                  lang === l.code
                    ? 'bg-white/25 border-white text-white shadow-lg backdrop-blur-sm'
                    : 'bg-white/8 border-white/20 text-white/70'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="mq-cta w-full h-14 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2"
          >
            {t('common.getStarted')}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}