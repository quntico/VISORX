import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { DebugErrorBoundary } from '@/components/DebugErrorBoundary';


import { authBootstrap } from "@/lib/authBootstrap";

async function start() {
  // Solo logs en devtools (te ayuda a ver si el modo normal está roto)
  await authBootstrap({ onLog: console.log });

  ReactDOM.createRoot(document.getElementById('root')).render(
    <DebugErrorBoundary>
      <App />
    </DebugErrorBoundary>
  );
}

start();
