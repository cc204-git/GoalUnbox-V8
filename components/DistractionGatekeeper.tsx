

import React, { useState, useEffect, useRef } from 'react';
import { createGatekeeperChat, GatekeeperResponse } from '../services/geminiService';
import Spinner from './Spinner';
import { Chat } from '@google/genai';

interface DistractionGatekeeperProps {
  goal: string;
  consequence: string | null;
  onConfirmSkip: () => void;
  onCancel: () => void;
}

const DistractionGatekeeper: React.FC<DistractionGatekeeperProps> = ({ goal, consequence, onConfirmSkip, onCancel }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<{ text: string, role: 'user' | 'model' }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSkipAllowed, setIsSkipAllowed] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const chatSession = createGatekeeperChat(goal, consequence);
            setChat(chatSession);
            // The initial message is now set in createGatekeeperChat history
            chatSession.getHistory().then(history => {
                 const initialModelMessage = JSON.parse(history[1].parts[0].text!) as GatekeeperResponse;
                 setMessages([{ role: 'model', text: initialModelMessage.response_text }]);
            });
        } catch (e) {
            console.error(e);
            setMessages([{ role: 'model', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    }, [goal, consequence]);
    
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
            const jsonResponse = JSON.parse(response.text) as GatekeeperResponse;
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
            <div className="glass-panel p-6 rounded-2xl shadow-2xl w-full max-w-lg relative">
                <h2 className="text-xl font-semibold mb-4 text-amber-300">Wait a second...</h2>
                <div className="mb-4 h-64 overflow-y-auto space-y-4 pr-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                    {messages.map((msg, index) => (
                      <div key={index} className={`flex items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-white ${msg.role === 'user' ? 'bg-cyan-600' : 'bg-slate-700'}`}>
                          <p className="text-sm" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{msg.text}</p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-[80%] rounded-xl px-3 py-2 text-white bg-slate-700 flex items-center gap-2">
                                <Spinner />
                                <span className="text-sm">thinking...</span>
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {isSkipAllowed ? (
                     <div className="text-center p-4 bg-green-900/50 rounded-lg border border-green-500/50">
                        <p className="text-green-300 mb-4">The gatekeeper has approved your request to skip.</p>
                        <button onClick={onConfirmSkip} className="w-full bg-amber-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-amber-400">
                            Confirm Skip Goal
                        </button>
                     </div>
                ) : (
                    <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="State your reason for skipping..."
                          disabled={isLoading}
                          className="form-input flex-grow rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!input.trim() || isLoading}
                          className="bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 button-glow-cyan"
                        >
                          Send
                        </button>
                    </div>
                )}
                 <button onClick={onCancel} className="mt-4 w-full bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors">
                    I'll Keep Going
                </button>
            </div>
        </div>
    );
};

export default DistractionGatekeeper;