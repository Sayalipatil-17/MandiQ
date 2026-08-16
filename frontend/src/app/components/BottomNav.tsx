import { useNavigate, useLocation } from 'react-router';
import { Home, TrendingUp, Bell, User } from 'lucide-react';
import { useT } from '../../i18n';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();

  const tabs = [
    { path: '/home',       icon: Home,       label: t('nav.home'),    emoji: '🏠' },
    { path: '/prediction', icon: TrendingUp,  label: t('nav.predict'), emoji: '📈' },
    { path: '/alerts',     icon: Bell,        label: t('nav.alerts'),  emoji: '🔔' },
    { path: '/profile',    icon: User,        label: t('nav.profile'), emoji: '👤' },
  ];

  return (
    <div className="mq-bottom-nav fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all mq-btn relative"
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2d6a3e]" />
              )}

              <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'bg-[#e8f5e9]'
                  : 'bg-transparent'
              }`}>
                <Icon className={`w-5 h-5 transition-colors ${
                  isActive ? 'text-[#2d6a3e]' : 'text-gray-400'
                }`} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>

              <span className={`text-[10px] font-semibold tracking-wide transition-colors ${
                isActive ? 'text-[#2d6a3e]' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
