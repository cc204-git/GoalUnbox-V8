
import React, { useState, useEffect, useRef } from 'react';
import { createGatekeeperChat } from '../services/geminiService.js';
import Spinner from './Spinner.js';

const DistractionGatekeeper = ({ goal, onConfirmSkip, onCancel, apiKey }) => {
    const [chat, setChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSkipAllowed, setIsSkipAllowed] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        try {
            const chatSession = createGatekeeperChat(goal, apiKey);
            setChat(chatSession);
            const history = chatSession.getHistory();
            const initialModelMessage = JSON.parse(history[1].parts[0].text);
            setMessages([{ role: 'model', text: initialModelMessage.response_text }]);
        } catch (e) {
            console.error(e);
            setMessages([{ role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    }, [goal, apiKey]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleSendMessage = async () => {
        if (!chat || !input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const response = await chat.sendMessage({ message: userMessage });
            const jsonResponse = JSON.parse(response.text);
            setMessages(prev => [...prev, { role: 'model', text: jsonResponse.response_text }]);
            if (jsonResponse.allow_skip) {
                setIsSkipAllowed(true);
            }
        } catch (err) {
            console.error("Gatekeeper chat error:", err);
            const errorMessage = "There was an error processing your response. Please try again.";
            setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        React.createElement('div', { className: "fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4" },
            React.createElement('div', { className: "bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-2xl w-full max-w-lg relative" },
                React.createElement('h2', { className: "text-xl font-semibold mb-4 text-amber-300" }, "Wait a second..."),
                React.createElement('div', { className: "mb-4 h-64 overflow-y-auto space-y-4 pr-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700" },
                    messages.map((msg, index) => (
                      React.createElement('div', { key: index, className: `flex items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}` },
                        React.createElement('div', { className: `max-w-[80%] rounded-lg px-3 py-2 text-white ${msg.role === 'user' ? 'bg-cyan-600' : 'bg-slate-700'}` },
                          React.createElement('p', { className: "text-sm", style: { whiteSpace: 'pre-wrap', wordWrap: 'break-word' } }, msg.text)
                        )
                      )
                    )),
                    isLoading && (
                        React.createElement('div', { className: "flex justify-start" },
                             React.createElement('div', { className: "max-w-[80%] rounded-lg px-3 py-2 text-white bg-slate-700 flex items-center gap-2" },
                                React.createElement(Spinner, null),
                                React.createElement('span', { className: "text-sm" }, "thinking...")
                             )
                        )
                    ),
                    React.createElement('div', { ref: messagesEndRef })
                ),
                isSkipAllowed ? (
                     React.createElement('div', { className: "text-center p-4 bg-green-900/50 rounded-lg border border-green-500/50" },
                        React.createElement('p', { className: "text-green-300 mb-4" }, "The gatekeeper has approved your request to skip."),
                        React.createElement('button', { onClick: onConfirmSkip, className: "w-full bg-amber-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-amber-400" },
                            "Confirm Skip Goal"
                        )
                     )
                ) : (
                    React.createElement('div', { className: "mt-4 flex gap-2" },
                        React.createElement('input', {
                          type: "text",
                          value: input,
                          onChange: (e) => setInput(e.target.value),
                          onKeyPress: (e) => e.key === 'Enter' && handleSendMessage(),
                          placeholder: "State your reason for skipping...",
                          disabled: isLoading,
                          className: "flex-grow bg-slate-800 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                        }),
                        React.createElement('button', {
                          onClick: handleSendMessage,
                          disabled: !input.trim() || isLoading,
                          className: "bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700"
                        }, "Send")
                    )
                ),
                 React.createElement('button', { onClick: onCancel, className: "mt-4 w-full bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors" },
                    "I'll Keep Going"
                )
            )
        )
    );
};

export default DistractionGatekeeper;
