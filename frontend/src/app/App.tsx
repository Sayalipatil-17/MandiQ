import { RouterProvider } from 'react-router';
import { router } from './routes';
import { LanguageProvider } from '../i18n';
import { AuthProvider } from '../AuthContext';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </LanguageProvider>
  );
}