import React, { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

export const APP_VERSION = "v3.17.18";

export function VersionManager() {
  const { toast } = useToast();

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch('/version.json?t=' + new Date().getTime(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverVersion = data.version;

        console.log(`[VersionManager] Client: ${APP_VERSION} | Server: ${serverVersion} `);

        if (serverVersion && serverVersion !== APP_VERSION) {
          console.warn("[VersionManager] Mismatch! Initiating Nuclear Cleanup...");

          // 1. Unregister Service Workers
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
              console.log("[VersionManager] Service Worker unregistered.");
            }
          }

          // 2. Delete all Caches
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log("[VersionManager] All Caches nuked.");
          }

          // 3. Visual Feedback
          toast({
            title: "Nueva Versión Detectada",
            description: `Actualizando de ${APP_VERSION} a ${serverVersion}...`,
            duration: 5000,
          });

          // 4. Hard Reload (Force Get)
          // DISABLE AUTO-RELOAD to prevent loops if server cache is stale
          /* 
          setTimeout(() => {
            console.log("[VersionManager] RELOADING NOW...");
            window.location.reload(true);
          }, 1000);
          */
        }
      } catch (error) {
        console.error("[VersionManager] Check failed:", error);
      }
    };

    // Check immediately and then every 30 seconds
    checkVersion();
    const interval = setInterval(checkVersion, 30000); // Poll every 30s

    // Also check on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return null;
}
