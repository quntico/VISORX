
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Converter from '@/pages/Converter';
import Project from '@/pages/Project';
import ModelView from '@/pages/ModelView';
import PublicViewer from '@/pages/PublicViewer';
import SetupAdmin from '@/pages/SetupAdmin';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Loader2 } from 'lucide-react';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-[#29B6F6] animate-spin" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) return <Navigate to="/login" />;
  if (role !== 'admin') {
    // User is logged in but not admin. Redirect to dashboard with a warning?
    // For now just redirect to dashboard
    return <Navigate to="/dashboard" />;
  }

  return children;
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Admin Only */}
            <Route path="/setup" element={<AdminRoute><SetupAdmin /></AdminRoute>} />

            {/* Authenticated Users */}
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/converter" element={<PrivateRoute><Converter /></PrivateRoute>} />
            <Route path="/project/:id" element={<PrivateRoute><Project /></PrivateRoute>} />
            <Route path="/model/:id" element={<PrivateRoute><ModelView /></PrivateRoute>} />

            {/* Public Access */}
            <Route path="/v/:token" element={<PublicViewer />} />

            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
          <Toaster />
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
