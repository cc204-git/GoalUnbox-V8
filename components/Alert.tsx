
import React from 'react';

interface AlertProps {
  message: string;
  type: 'error' | 'info';
}

const Alert: React.FC<AlertProps> = ({ message, type }) => {
  const baseClasses = 'p-4 rounded-md text-sm mb-6';
  const typeClasses = {
    error: 'bg-red-900/50 border border-red-500/50 text-red-300',
    info: 'bg-sky-900/50 border border-sky-500/50 text-sky-300',
  };

  return (
    <div className={`${baseClasses} ${typeClasses[type]}`}>
      {message}
    </div>
  );
};

export default Alert;
