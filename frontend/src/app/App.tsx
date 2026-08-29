import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { LanguageProvider } from '../i18n';
import { AuthProvider } from '../AuthContext';
import { setupHardwareBackButton } from '../backButton';

export default function App() {
  useEffect(() => {
    setupHardwareBackButton();
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </LanguageProvider>
  );
}