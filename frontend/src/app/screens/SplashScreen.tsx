import { useNavigate } from 'react-router';
import { Sprout, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useT, type Lang } from '../../i18n';
import bgImage from '../../assets/mandiq-bg.png';

const BG_IMAGE = bgImage;

export function SplashScreen() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useT();

  const languages: { code: Lang; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'pa', label: 'ਪੰਜਾਬੀ' },
    { code: 'mr', label: 'मराठी' },
  ];

  return (
    <div className="relative min-h-screen flex flex-col max-w-md mx-auto overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-[#1b4228]/60 to-[#1b4228]/90" />

      <div className="relative z-10 flex flex-col items-center justify-between min-h-screen p-6">
        <div className="flex-1 flex flex-col items-center justify-center pt-12">
         <div className="w-24 h-24 bg-white/15 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 shadow-lg border border-white/20">
  <Sprout className="w-14 h-14 text-white" strokeWidth={2.5} />
</div>

          <h1 className="text-5xl mb-2 font-extrabold drop-shadow-lg tracking-wide">
  <span className="text-white">Mandi</span><span className="text-[#4ade80]">Q</span>
</h1>

          <p className="text-lg text-[#e8f5e9] mb-6 drop-shadow">
            {t('app.tagline')}
          </p>

          <p className="text-center text-white/90 max-w-xs drop-shadow">
            {t('app.subtitle')}
          </p>
        </div>

        <div className="w-full mb-6">
          <p className="text-sm mb-3 text-center text-white/80">
            {t('common.selectLang')}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`py-3 px-4 rounded-2xl border-2 transition-all backdrop-blur-sm ${
                  lang === l.code
                    ? 'bg-[#2d6a3e] border-[#2d6a3e] text-white'
                    : 'bg-white/10 border-white/30 text-white'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => navigate('/login')}
            className="w-full bg-[#f97316] hover:bg-[#ea670c] text-white h-14 rounded-2xl shadow-lg"
          >
            {t('common.getStarted')}
            <ChevronRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}