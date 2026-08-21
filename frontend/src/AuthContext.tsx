import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { initOneSignal, loginOneSignal, logoutOneSignal } from './onesignal';

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface User {
  id: number;
  mobile_number: string;
  name?: string;
  user_type?: string;
  farmer_details?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

<<<<<<< HEAD
// App start hote hi OneSignal init karo
initOneSignal().catch(() => {});
=======
/** OneSignal ko bata do ye push kis farmer ka hai — targeted alerts ke liye. */
function linkOneSignal(userId: number) {
  const os = (window as any).OneSignalDeferred;
  if (!os) return;
  os.push(async (OneSignal: any) => {
    try { await OneSignal.login(String(userId)); } catch {}
  });
}

function unlinkOneSignal() {
  const os = (window as any).OneSignalDeferred;
  if (!os) return;
  os.push(async (OneSignal: any) => {
    try { await OneSignal.logout(); } catch {}
  });
}
>>>>>>> 45171e5581b5a1b99354c431789835c3bfcd8c2d

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('mandiq_token'));

  useEffect(() => {
    if (token) refreshUser();
  }, []);

  async function refreshUser() {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const u = await res.json();
        setUser(u);
<<<<<<< HEAD
        if (u?.id) loginOneSignal(u.id).catch(() => {});
=======
        if (u?.id) linkOneSignal(u.id);
>>>>>>> 45171e5581b5a1b99354c431789835c3bfcd8c2d
      }
      else logout();
    } catch { logout(); }
  }

  function login(newToken: string, newUser: User) {
    localStorage.setItem('mandiq_token', newToken);
    setToken(newToken);
    setUser(newUser);
<<<<<<< HEAD
    if (newUser?.id) loginOneSignal(newUser.id).catch(() => {});
=======
    if (newUser?.id) linkOneSignal(newUser.id);
>>>>>>> 45171e5581b5a1b99354c431789835c3bfcd8c2d
  }

  function logout() {
    localStorage.removeItem('mandiq_token');
    setToken(null);
    setUser(null);
<<<<<<< HEAD
    logoutOneSignal().catch(() => {});
=======
    unlinkOneSignal();
>>>>>>> 45171e5581b5a1b99354c431789835c3bfcd8c2d
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);