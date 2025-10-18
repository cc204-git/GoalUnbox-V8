import React from 'react';

const Header = () => {
  return React.createElement(
    'header',
    { className: 'text-center p-6' },
    React.createElement(
      'h1',
      { className: 'text-4xl font-bold tracking-tighter text-cyan-400' },
      'Goal Unbox'
    ),
    React.createElement(
      'p',
      { className: 'text-slate-400 mt-2' },
      'Lock your phone. Unlock your focus.'
    )
  );
};

export default Header;
