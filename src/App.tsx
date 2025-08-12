import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { AuthForm } from '@/components/auth/AuthForm';
import { WelcomeSplash } from '@/components/WelcomeSplash';
import { useAuth } from '@/hooks/useAuth';
import { Toaster } from 'sonner';

// Lazy load page components for better performance
const Dashboard = lazy(() => import('@/pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Availability = lazy(() => import('@/pages/Availability').then(module => ({ default: module.Availability })));
const Sessions = lazy(() => import('@/pages/Sessions').then(module => ({ default: module.Sessions })));
const Settings = lazy(() => import('@/pages/Settings').then(module => ({ default: module.Settings })));
const Analytics = lazy(() => import('@/pages/Analytics').then(module => ({ default: module.Analytics })));
const Badges = lazy(() => import('@/pages/Badges').then(module => ({ default: module.Badges })));
const TestWhatsApp = lazy(() => import('@/pages/TestWhatsApp').then(module => ({ default: module.TestWhatsApp })));
const CreateTestUser = lazy(() => import('@/pages/CreateTestUser').then(module => ({ default: module.CreateTestUser })));
const AuthCallback = lazy(() => import('@/pages/AuthCallback'));

function AppContent() {
  const { user, profile, loading, error, justLoggedIn, clearJustLoggedIn } = useAuth();
  const [showSplash, setShowSplash] = useState(false);

  // Show splash only when user just logged in (not on session restoration)
  // Wait for BOTH user AND profile to be loaded before showing splash
  useEffect(() => {
    console.log('[App] Auth state changed:', { 
      justLoggedIn, 
      hasUser: !!user, 
      hasProfile: !!profile, 
      loading,
      userEmail: user?.email 
    });
    
    if (justLoggedIn && user && profile && !loading) {
      console.log('[App] Showing welcome splash for authenticated user with profile');
      setShowSplash(true);
    }
  }, [justLoggedIn, user, profile, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-primary mx-auto"></div>
          <div className="mt-4">
            <h2 className="text-lg font-semibold text-foreground mb-2">GymBuddy</h2>
            <p className="text-muted-foreground">Loading your workout companion...</p>
            <div className="mt-2 text-xs text-muted-foreground">
              Initializing app components
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-800">Authentication Error</h1>
          <p className="mt-2 text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  // Show welcome splash on first load after authentication
  if (showSplash && user) {
    return (
      <WelcomeSplash 
        onComplete={() => {
          setShowSplash(false);
          clearJustLoggedIn();
        }} 
      />
    );
  }

  // Loading component for lazy-loaded routes
  const PageLoader = () => (
    <div className="min-h-[400px] bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground text-sm">Loading page...</p>
      </div>
    </div>
  );

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="availability" element={<Availability />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="settings" element={<Settings />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="badges" element={<Badges />} />
          <Route path="test-whatsapp" element={<TestWhatsApp />} />
          <Route path="create-test-user" element={<CreateTestUser />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;