import { createBrowserRouter, Navigate } from "react-router";
import { SplashScreen } from "./screens/SplashScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { OtpScreen } from "./screens/OtpScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { CropBrowseScreen } from "./screens/CropBrowseScreen";
import { PredictionScreen } from "./screens/PredictionScreen";
import { MandiCompareScreen } from "./screens/MandiCompareScreen";
import { MandiInfoScreen } from "./screens/MandiInfoScreen";
import { AlertsScreen } from "./screens/AlertsScreen";
import { PastTrendScreen } from "./screens/PastTrendScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { UserTypeScreen } from "./screens/onboarding/UserTypeScreen";
import { NameScreen } from "./screens/onboarding/NameScreen";
import { LocationScreen } from "./screens/onboarding/LocationScreen";
import { CropSelectionScreen } from "./screens/onboarding/CropSelectionScreen";
import { useAuth } from "../AuthContext";

// Protection Guard Component for Routes
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  // Public Routes
  { path: "/", Component: SplashScreen },
  { path: "/login", Component: LoginScreen },
  { path: "/otp", Component: OtpScreen },

  // Protected Main App Routes
  { path: "/home", Component: () => <ProtectedRoute><HomeScreen /></ProtectedRoute> },
  { path: "/crops", Component: () => <ProtectedRoute><CropBrowseScreen /></ProtectedRoute> },
  { path: "/prediction", Component: () => <ProtectedRoute><PredictionScreen /></ProtectedRoute> },
  { path: "/compare", Component: () => <ProtectedRoute><MandiCompareScreen /></ProtectedRoute> },
  { path: "/mandi-info", Component: () => <ProtectedRoute><MandiInfoScreen /></ProtectedRoute> },
  { path: "/alerts", Component: () => <ProtectedRoute><AlertsScreen /></ProtectedRoute> },
  { path: "/past-trend", Component: () => <ProtectedRoute><PastTrendScreen /></ProtectedRoute> },
  { path: "/profile", Component: () => <ProtectedRoute><ProfileScreen /></ProtectedRoute> },

  // Protected Onboarding Wizard Routes
  { path: "/onboarding/user-type", Component: () => <ProtectedRoute><UserTypeScreen /></ProtectedRoute> },
  { path: "/onboarding/name", Component: () => <ProtectedRoute><NameScreen /></ProtectedRoute> },
  { path: "/onboarding/location", Component: () => <ProtectedRoute><LocationScreen /></ProtectedRoute> },
  { path: "/onboarding/crops", Component: () => <ProtectedRoute><CropSelectionScreen /></ProtectedRoute> },
]);