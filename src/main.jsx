import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { DebugErrorBoundary } from '@/components/DebugErrorBoundary';


// Fixed main.jsx - Imports were missing!
ReactDOM.createRoot(document.getElementById('root')).render(
  <DebugErrorBoundary>
    <App />
  </DebugErrorBoundary>
);
