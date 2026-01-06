import React, { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

const APP_VERSION = '3.15.2';

export function VersionManager() {
    const { toast } = useToast();

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = await fetch('/version.json?t=' + new Date().getTime());
                if (!res.ok) return;
                const data = await res.json();
                const serverVersion = data.version;

                console.log(`Version Check: Client=${APP_VERSION} Server=${serverVersion}`);

                if (serverVersion && serverVersion !== APP_VERSION) {
                    console.warn("New version detected! Reloading...");

                    // Clear cache aggressively
                    if ('caches' in window) {
                        try {
                            const keys = await caches.keys();
                            await Promise.all(keys.map(key => caches.delete(key)));
                            console.log("Caches cleared.");
                        } catch (e) {
                            console.error("Cache clear failed", e);
                        }
                    }

                    // Visual feedback before reload
                    toast({
                        title: "Actualización Disponible",
                        description: "Recargando para aplicar cambios...",
                        duration: 5000,
                    });

                    // Give UI a moment to show toast then reload
                    setTimeout(() => {
                        window.location.reload(true);
                    }, 1500);
                }
            } catch (error) {
                console.error("Failed to check version:", error);
            }
        };

        // Check on mount
        checkVersion();

        // Check on focus (tab switch)
        window.addEventListener('focus', checkVersion);
        return () => window.removeEventListener('focus', checkVersion);
    }, []);

    return null; // Invisible component
}
