import { supabase } from "./supabase";

export async function authBootstrap({ onLog } = {}) {
    const log = (...args) => onLog?.(...args);

    // 1) Evitar que un Service Worker viejo rompa auth (solo reporta)
    if ("serviceWorker" in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            log?.("[AUTH] SW regs:", regs?.length || 0);
        } catch {
            // ignore
        }
    }

    // 2) Si vienes de Google con #access_token, Supabase lo detecta,
    // pero a veces tu app limpia el hash antes. Aquí forzamos getSession.
    let session = null;
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        session = data?.session || null;
        log?.("[AUTH] getSession ok:", !!session);
    } catch (e) {
        log?.("[AUTH] getSession error:", e?.message || e);
    }

    // 3) Si hay tokens en URL hash, y ya tenemos sesión, limpiamos el hash
    // para que no quede "#access_token=..." pegado (y cause loops)
    try {
        if (session && window.location.hash?.includes("access_token")) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            log?.("[AUTH] cleaned hash tokens");
        }
    } catch {
        // ignore
    }

    // 4) Listener para cambios de auth (mantiene estado estable)
    supabase.auth.onAuthStateChange((event, newSession) => {
        log?.("[AUTH] event:", event, "session:", !!newSession);
    });

    return session;
}
