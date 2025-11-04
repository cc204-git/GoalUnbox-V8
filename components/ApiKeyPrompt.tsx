
import React, { useState } from 'react';
import Spinner from './Spinner';

interface ApiKeyPromptProps {
  onSubmit: (apiKey: string) => void;
  error?: string | null;
}

const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onSubmit, error: initialError }) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(initialError || null);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError("API Key cannot be empty.");
            return;
        }
        setIsLoading(true);
        onSubmit(apiKey.trim());
    };

    return (
        <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-md text-center animate-fade-in">
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Enter Your API Key</h2>
            <p className="text-slate-400 mb-6">
                Your Google Gemini API key is required. It's stored in your browser's local storage and never leaves your device.
            </p>
            {error && <div className="p-4 rounded-md text-sm mb-6 bg-red-900/30 border border-red-500/30 text-red-300">{error}</div>}
             <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                        setApiKey(e.target.value);
                        setError(null);
                    }}
                    placeholder="Enter your Gemini API Key"
                    required
                    className="form-input w-full rounded-lg p-3 text-slate-200 placeholder-slate-500 transition"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading || !apiKey.trim()}
                    className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center button-glow-cyan"
                >
                    {isLoading ? <Spinner /> : 'Save and Continue'}
                </button>
            </form>
             <p className="text-xs text-slate-500 mt-4">
                Get your API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google AI Studio</a>.
            </p>
        </div>
    );
};

export default ApiKeyPrompt;
