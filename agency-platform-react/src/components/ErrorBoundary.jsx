import React from 'react';
import Illustration from './Illustration';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-bg flex items-center justify-center p-6">
                    <div className="glass p-8 rounded-3xl border border-border max-w-md text-center">
                        <div className="flex justify-center mb-4">
                            <Illustration name="error" size={160} alt="Nova se disculpa: algo salió mal" />
                        </div>
                        <h2 className="font-head text-xl font-bold mb-2">Algo salió mal</h2>
                        <p className="text-muted text-sm mb-4">{this.state.error?.message || 'Error desconocido'}</p>
                        <button 
                            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
                            className="bg-accent text-bg px-6 py-2 rounded-xl font-bold"
                        >
                            Recargar
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
