import React, { useState, useRef, useEffect } from 'react';
import Spinner from './Spinner';

interface ChatBoxProps {
  messages: { text: string; role: 'user' | 'model' }[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-900/50 p-4">
        <h3 className="text-lg font-semibold text-slate-300 mb-4 text-left">Chat with Verifier</h3>
      <div className="h-64 overflow-y-auto space-y-4 pr-2 flex flex-col">
        {messages.map((msg, index) => (
          <div key={index} className={`flex items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2 text-white ${msg.role === 'user' ? 'bg-cyan-600' : 'bg-slate-700'}`}>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="max-w-[80%] rounded-xl px-4 py-2 text-white bg-slate-700 flex items-center gap-2">
                    <Spinner />
                    <span className="text-sm">thinking...</span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Explain here..."
          disabled={isLoading}
          className="form-input flex-grow rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all button-glow-cyan"
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatBox;