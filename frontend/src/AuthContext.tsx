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

// App start hote hi OneSignal init karo
initOneSignal().catch(() => {});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('mandiq_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('mandiq_token'));

  useEffect(() => {
    if (token) refreshUser();
  }, [token]);

  async function refreshUser() {
    if (!token) return;
    try {
      const res = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const u = await res.json();
        setUser(u);
        localStorage.setItem('mandiq_user', JSON.stringify(u));
        if (u?.id) loginOneSignal(u.id).catch(() => {});
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch (e) {
      console.warn('Network issue during refreshUser, keeping cached session:', e);
    }
  }

  function login(newToken: string, newUser: User) {
    localStorage.setItem('mandiq_token', newToken);
    localStorage.setItem('mandiq_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (newUser?.id) loginOneSignal(newUser.id).catch(() => {});
  }

  function logout() {
    localStorage.removeItem('mandiq_token');
    localStorage.removeItem('mandiq_user');
    setToken(null);
    setUser(null);
    logoutOneSignal().catch(() => {});
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
