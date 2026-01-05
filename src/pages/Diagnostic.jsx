import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldAlert, RefreshCw, Server, Wifi, Database, Lock } from 'lucide-react';

const DIAGNOSTIC_PWD = "admin"; // Simple password for now

export default function Diagnostic() {
    const { user } = useAuth();
    const [password, setPassword] = useState('');
    const [unlocked, setUnlocked] = useState(false);
    const [loading, setLoading] = useState(false);

    const [stats, setStats] = useState({
        ping: null,
        projects: null,
        models: null,
        error: null,
        logs: []
    });

    const addLog = (msg) => {
        setStats(prev => ({ ...prev, logs: [...prev.logs, `[${new Date().toLocaleTimeString()}] ${msg}`] }));
    };

    const checkPassword = () => {
        if (password === DIAGNOSTIC_PWD) {
            setUnlocked(true);
            runDiagnostics();
        } else {
            alert("Contraseña incorrecta");
        }
    };

    const runDiagnostics = async () => {
        setLoading(true);
        setStats({ ping: null, projects: null, models: null, error: null, logs: [] });
        addLog("Iniciando diagnóstico completo...");

        try {
            // 1. CHECK CONFIG
            addLog(`Configuración: URL=${isSupabaseConfigured() ? 'OK' : 'MISSING'}`);
            if (!isSupabaseConfigured()) throw new Error("Supabase Keys Missing in .env.local");

            // 2. TOKEN CHECK
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            addLog(`Token de Sesión: ${token ? 'PRESENTE' : 'AUSENTE'}`);

            const headers = token ? {
                'apikey': supabase.supabaseKey,
                'Authorization': `Bearer ${token}`
            } : { 'apikey': supabase.supabaseKey };

            // 3. PING TEST
            addLog("Pinging Server (HEAD request)...");
            const start = Date.now();
            const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Network")), ms));

            const pingReq = await Promise.race([
                fetch(`${supabase.supabaseUrl}/rest/v1/`, { method: 'HEAD', headers }),
                timeout(5000)
            ]);

            const pingTime = Date.now() - start;
            setStats(prev => ({ ...prev, ping: `${pingTime}ms (HTTP ${pingReq.status})` }));
            addLog(`Ping completado en ${pingTime}ms`);

            if (!pingReq.ok) addLog(`⚠️ Alerta: Server respondió status ${pingReq.status}`);

            // 4. DATA CHECK
            if (token) {
                addLog("Consultando Proyectos (vía REST)...");
                const projsReq = await fetch(`${supabase.supabaseUrl}/rest/v1/projects?select=*&limit=1`, { headers });
                const projs = await projsReq.json();
                setStats(prev => ({ ...prev, projects: Array.isArray(projs) ? projs.length : 'ERR' }));
                addLog(`Respuesta Proyectos: ${JSON.stringify(projs).substring(0, 100)}...`);

                addLog("Consultando Modelos (vía REST)...");
                const modelsReq = await fetch(`${supabase.supabaseUrl}/rest/v1/models?select=*&limit=1`, { headers });
                const models = await modelsReq.json();
                setStats(prev => ({ ...prev, models: Array.isArray(models) ? models.length : 'ERR' }));
            } else {
                addLog("⚠️ Saltando chequeo de datos por falta de Token (Login requerido)");
            }

        } catch (e) {
            addLog(`💥 ERROR CRÍTICO: ${e.message}`);
            setStats(prev => ({ ...prev, error: e.message }));
        } finally {
            setLoading(false);
            addLog("Diagnóstico finalizado.");
        }
    };

    const forceReset = () => {
        localStorage.clear();
        window.location.reload();
    };

    if (!unlocked) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-gray-900 p-8 rounded border border-gray-800 w-full max-w-md">
                    <div className="flex justify-center mb-6">
                        <ShieldAlert className="w-12 h-12 text-red-500" />
                    </div>
                    <h1 className="text-xl text-white text-center font-bold mb-4">Panel de Diagnóstico</h1>
                    <Input
                        type="password"
                        placeholder="Contraseña de acceso"
                        className="mb-4 bg-black border-gray-700 text-white"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button onClick={checkPassword} className="w-full">Entrar</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 font-mono">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8 border-b border-gray-800 pb-4">
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-green-500">
                        <Server /> VISOR-X DIAGNOSTICS
                    </h1>
                    <Button variant="outline" onClick={() => setUnlocked(false)}><Lock className="w-4 h-4 mr-2" /> Bloquear</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
                        <div className="text-gray-400 text-sm mb-1 flex items-center gap-2"><Wifi className="w-4 h-4" /> Ping Server</div>
                        <div className={`text-2xl font-bold ${stats.ping ? 'text-green-400' : 'text-gray-600'}`}>
                            {stats.ping || '--'}
                        </div>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
                        <div className="text-gray-400 text-sm mb-1 flex items-center gap-2"><Database className="w-4 h-4" /> User Data Check</div>
                        <div className="text-xl">
                            Proj: <span className="text-blue-400">{stats.projects ?? '-'}</span> |
                            Mod: <span className="text-yellow-400">{stats.models ?? '-'}</span>
                        </div>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
                        <div className="text-gray-400 text-sm mb-1">Acciones</div>
                        <Button onClick={runDiagnostics} disabled={loading} size="sm" className="mr-2">
                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Re-Escanear'}
                        </Button>
                        <Button onClick={forceReset} variant="destructive" size="sm">
                            Reset App
                        </Button>
                    </div>
                </div>

                <div className="bg-black p-4 rounded border border-gray-800 h-96 overflow-y-auto font-mono text-xs">
                    {stats.logs.map((log, i) => (
                        <div key={i} className="mb-1 border-b border-gray-900/50 pb-1">
                            {log}
                        </div>
                    ))}
                    {stats.logs.length === 0 && <span className="text-gray-600">Esperando inicio...</span>}
                </div>
            </div>
        </div>
    );
}
