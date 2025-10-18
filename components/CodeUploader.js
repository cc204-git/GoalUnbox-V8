import React, { useState, useCallback, useRef } from 'react';
import Spinner from './Spinner.js';
import CameraCapture from './CameraCapture.js';

const CodeUploader = ({ onCodeImageSubmit, isLoading }) => {
  const [file, setFile] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };
  
  const handleCapture = (capturedFile) => {
    setFile(capturedFile);
    setShowCamera(false); // Close camera view
  };

  const handleSubmit = useCallback(() => {
    if (file) {
      onCodeImageSubmit(file);
    }
  }, [file, onCodeImageSubmit]);

  const handleSelectFileClick = () => {
    fileInputRef.current?.click();
  };

  return React.createElement(
    React.Fragment,
    null,
    showCamera && React.createElement(CameraCapture, { onCapture: handleCapture, onCancel: () => setShowCamera(false) }),
    React.createElement(
      'div',
      { className: 'bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in' },
      React.createElement('h2', { className: 'text-2xl font-semibold mb-2 text-cyan-300' }, 'Step 1: Sequester Your Code'),
      React.createElement('p', { className: 'text-slate-400 mb-6' }, 'Take a picture of the 3-digit code on your lock box. The code will be hidden until your goal is complete.'),
      React.createElement('input', {
        type: 'file',
        accept: 'image/*',
        onChange: handleFileChange,
        className: 'hidden',
        ref: fileInputRef,
        disabled: isLoading,
      }),
      React.createElement(
        'div',
        { className: 'border-2 border-dashed border-slate-600 rounded-lg p-6 mb-6 hover:border-cyan-400 transition-colors duration-300 min-h-[150px] flex items-center justify-center' },
        file
          ? React.createElement(
              'div',
              { className: 'flex flex-col items-center justify-center gap-4 text-green-400' },
              React.createElement(
                'svg',
                { xmlns: 'http://www.w3.org/2000/svg', className: 'h-12 w-12', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2 },
                React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' })
              ),
              React.createElement('p', { className: 'font-semibold' }, 'Image Received. The code is now hidden.'),
              React.createElement('p', { className: 'text-sm text-slate-400' }, file.name),
              React.createElement('button', { onClick: handleSelectFileClick, disabled: isLoading, className: 'text-sm text-cyan-400 hover:text-cyan-300' }, 'Change file')
            )
          : React.createElement(
              'div',
              { className: 'flex flex-col items-center justify-center gap-4' },
              React.createElement('p', { className: 'text-slate-500' }, 'Upload a picture of your code:'),
              React.createElement(
                'div',
                { className: 'flex gap-4' },
                React.createElement('button', { onClick: handleSelectFileClick, disabled: isLoading, className: 'bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors' }, 'Select File'),
                React.createElement('button', { onClick: () => setShowCamera(true), disabled: isLoading, className: 'bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors' }, 'Take Photo')
              )
            )
      ),
      React.createElement(
        'button',
        { onClick: handleSubmit, disabled: !file || isLoading, className: 'w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center' },
        isLoading ? React.createElement(Spinner, null) : 'Analyze & Save Code'
      )
    )
  );
};

export default CodeUploader;
