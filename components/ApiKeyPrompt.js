
import React, { useState } from 'react';
import Spinner from './Spinner.js';

const ApiKeyPrompt = ({ onSubmit, error: initialError }) => {
    const [apiKey, setApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(initialError || null);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError("API Key cannot be empty.");
            return;
        }
        setIsLoading(true);
        onSubmit(apiKey.trim());
    };

    const form = React.createElement('form', { onSubmit: handleSubmit, className: "space-y-4" },
        React.createElement('input', {
            type: "password",
            value: apiKey,
            onChange: (e) => setApiKey(e.target.value),
            placeholder: "Enter your Gemini API Key",
            required: true,
            className: "w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition",
            disabled: isLoading,
        }),
        React.createElement('button', {
            type: "submit",
            disabled: isLoading || !apiKey.trim(),
            className: "w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        }, isLoading ? React.createElement(Spinner, null) : 'Save and Continue')
    );

    return React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in" },
        React.createElement('h2', { className: "text-2xl font-semibold mb-2 text-cyan-300" }, 'Enter Your API Key'),
        React.createElement('p', { className: "text-slate-400 mb-6" }, 'Your Google Gemini API key is required to use this application. It is stored securely in your browser\'s local storage and never leaves your device.'),
        error && React.createElement('div', { className: "p-4 rounded-md text-sm mb-6 bg-red-900/50 border border-red-500/50 text-red-300" }, error),
        form,
        React.createElement('p', { className: "text-xs text-slate-500 mt-4" },
            'You can get your API key from ',
            React.createElement('a', { href: "https://aistudio.google.com/app/apikey", target: "_blank", rel: "noopener noreferrer", className: "text-cyan-400 hover:underline" }, 'Google AI Studio'),
            '.'
        )
    );
};

export default ApiKeyPrompt;
