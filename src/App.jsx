import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Converter from '@/pages/Converter'; // Safe Mode
import { LanguageProvider } from '@/contexts/LanguageContext'; // Safe Mode
import { AuthProvider } from '@/contexts/AuthContext';
import Dashboard from '@/pages/Dashboard'; // RESTORING DASHBOARD
import Login from '@/pages/Login'; // RESTORING LOGIN
import { DebugErrorBoundary } from '@/components/DebugErrorBoundary';

// STAGE 21: FULL APP SKELETON (Providers + Dashboard + Green Converter)
import { VersionManager } from '@/components/VersionManager';

function App() {
  return (
    <Router>
      <VersionManager />
      <AuthProvider>
        <LanguageProvider>
          {/* Removed Debug Bar - Going for Real UI */}
          <Routes>
            {/* PUBLIC */}
            <Route path="/login" element={<Login />} />

            {/* PRIVATE (Direct access for now) */}
            <Route path="/dashboard" element={<Dashboard />} />

            {/* CONVERTER */}
            <Route path="/project/:id" element={
              <DebugErrorBoundary>
                <Converter />
              </DebugErrorBoundary>
            } />
            <Route path="/converter" element={
              <DebugErrorBoundary>
                <Converter />
              </DebugErrorBoundary>
            } />

            {/* FALLBACKS */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
