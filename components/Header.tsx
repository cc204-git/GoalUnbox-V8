
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="text-center p-6 mb-4">
      <div className="inline-flex items-center gap-3">
        <svg width="40" height="40" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" rx="64" fill="none"/>
          <path d="M128 224V160C128 106.981 170.981 64 224 64H288C341.019 64 384 106.981 384 160V224H128Z" fill="#1e293b"/>
          <rect x="96" y="224" width="320" height="224" rx="32" fill="#2dd4bf"/>
          <circle cx="256" cy="336" r="48" fill="#0f172a"/>
        </svg>
        <h1 className="text-4xl font-bold tracking-tighter text-glow-cyan text-slate-100">
          Goal Unbox
        </h1>
      </div>
      <p className="text-slate-400 mt-2">Your personal AI-powered focus partner.</p>
    </header>
  );
};

export default Header;