import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Availability } from '@/pages/Availability';
import { Sessions } from '@/pages/Sessions';
import { Settings } from '@/pages/Settings';
import { Analytics } from '@/pages/Analytics';
import { Badges } from '@/pages/Badges';
import { TestWhatsApp } from '@/pages/TestWhatsApp';
import { CreateTestUser } from '@/pages/CreateTestUser';
import { AuthForm } from '@/components/auth/AuthForm';
import { WelcomeSplash } from '@/components/WelcomeSplash';
import { useAuth } from '@/hooks/useAuth';
import { Toaster } from 'sonner';

function AppContent() {
  const { user, loading, error } = useAuth();
  const [showSplash, setShowSplash] = useState(false);

  // Show splash when user becomes authenticated and we haven't shown it this session
  useEffect(() => {
    if (user && !loading) {
      const hasShownSplash = sessionStorage.getItem('gymbuddy_splash_shown');
      if (!hasShownSplash) {
        setShowSplash(true);
      }
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading authentication...</p>
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
          sessionStorage.setItem('gymbuddy_splash_shown', 'true');
        }} 
      />
    );
  }

  return (
    <Routes>
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
  );
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.PROD ? "/GymBuddy" : ""}>
      <AppContent />
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;