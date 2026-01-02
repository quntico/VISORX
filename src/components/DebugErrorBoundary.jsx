import React from 'react';
import { AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export class DebugErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleCopyError = async () => {
        const text = `Error: ${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack}`;
        try {
            await navigator.clipboard.writeText(text);
            alert("Error copiado al portapapeles.");
        } catch (err) {
            console.error('Failed to copy: ', err);
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert("Error copiado al portapapeles (fallback).");
            } catch (err) {
                alert("No se pudo copiar el error automáticamente.");
            }
            document.body.removeChild(textArea);
        }
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-[#0B0F14] text-white flex flex-col items-center justify-center p-4 overflow-auto">
                    <div className="max-w-2xl w-full bg-[#151B23] border border-red-500/30 rounded-lg p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4 text-red-400">
                            <AlertCircle className="h-8 w-8" />
                            <h2 className="text-xl font-bold">¡Algo salió mal! (Crash Report)</h2>
                        </div>

                        <p className="text-gray-300 mb-6">
                            La aplicación ha encontrado un error crítico y no puede continuar.
                            Por favor copia este error y envíalo al soporte técnico.
                        </p>

                        <div className="bg-black/50 p-4 rounded border border-white/10 font-mono text-xs overflow-auto max-h-[300px] mb-6 whitespace-pre-wrap text-red-300">
                            {this.state.error && this.state.error.toString()}
                            <br />
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </div>

                        <div className="flex gap-4">
                            <Button onClick={this.handleReload} className="bg-[#29B6F6] text-black hover:bg-[#29B6F6]/90">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Recargar Página
                            </Button>
                            <Button variant="outline" onClick={this.handleCopyError} className="border-white/20 hover:bg-white/10">
                                <Copy className="h-4 w-4 mr-2" />
                                Copiar Error
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
