
import React from 'react';

interface AlertProps {
  message: string;
  type: 'error' | 'info';
}

const Alert: React.FC<AlertProps> = ({ message, type }) => {
  const typeClasses = {
    error: {
      container: 'bg-red-900/30 border border-red-500/30 text-red-300',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
    info: {
      container: 'bg-sky-900/30 border border-sky-500/30 text-sky-300',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414l-3-3z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  return (
    <div className={`p-4 rounded-lg text-sm mb-6 flex items-start gap-3 ${typeClasses[type].container}`}>
      <div className="flex-shrink-0 mt-0.5">
        {typeClasses[type].icon}
      </div>
      <span>{message}</span>
    </div>
  );
};

export default Alert;