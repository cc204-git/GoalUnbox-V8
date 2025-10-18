import React, { useState, useRef, useEffect } from 'react';
import Spinner from './Spinner.js';

const ChatBox = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return React.createElement(
    'div',
    { className: 'border border-slate-700 rounded-lg bg-slate-900/50 p-4' },
    React.createElement('h3', { className: 'text-lg font-semibold text-slate-300 mb-4 text-left' }, 'Chat with Verifier'),
    React.createElement(
      'div',
      { className: 'h-64 overflow-y-auto space-y-4 pr-2 flex flex-col' },
      messages.map((msg, index) =>
        React.createElement(
          'div',
          { key: index, className: `flex items-end ${msg.role === 'user' ? 'justify-end' : 'justify-start'}` },
          React.createElement(
            'div',
            { className: `max-w-[80%] rounded-lg px-4 py-2 text-white ${msg.role === 'user' ? 'bg-cyan-600' : 'bg-slate-700'}` },
            React.createElement('p', { className: 'text-sm', style: { whiteSpace: 'pre-wrap', wordWrap: 'break-word' } }, msg.text)
          )
        )
      ),
      isLoading && React.createElement(
        'div',
        { className: 'flex justify-start' },
        React.createElement(
          'div',
          { className: 'max-w-[80%] rounded-lg px-4 py-2 text-white bg-slate-700 flex items-center gap-2' },
          React.createElement(Spinner, null),
          React.createElement('span', { className: 'text-sm' }, 'thinking...')
        )
      ),
      React.createElement('div', { ref: messagesEndRef })
    ),
    React.createElement(
      'div',
      { className: 'mt-4 flex gap-2' },
      React.createElement('input', {
        type: 'text',
        value: input,
        onChange: (e) => setInput(e.target.value),
        onKeyPress: handleKeyPress,
        placeholder: 'Explain here...',
        disabled: isLoading,
        className: 'flex-grow bg-slate-800 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition',
      }),
      React.createElement(
        'button',
        {
          onClick: handleSend,
          disabled: !input.trim() || isLoading,
          className: 'bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all',
          'aria-label': 'Send message',
        },
        'Send'
      )
    )
  );
};

export default ChatBox;
