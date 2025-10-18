import React from 'react';

const Alert = ({ message, type }) => {
  const baseClasses = 'p-4 rounded-md text-sm mb-6';
  const typeClasses = {
    error: 'bg-red-900/50 border border-red-500/50 text-red-300',
    info: 'bg-sky-900/50 border border-sky-500/50 text-sky-300',
  };

  return React.createElement(
    'div',
    { className: `${baseClasses} ${typeClasses[type]}` },
    message
  );
};

export default Alert;
