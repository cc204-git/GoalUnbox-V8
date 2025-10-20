
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Spinner from './Spinner.js';
import CameraCapture from './CameraCapture.js';
import { formatCountdown } from '../utils/timeUtils.js';

const PDFIcon = () => React.createElement(
    'svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-8 w-8 text-red-400', viewBox: '0 0 20 20', fill: 'currentColor' },
    React.createElement('path', { fillRule: 'evenodd', d: 'M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.414a1 1 0 00-.293-.707l-4.414-4.414A1 1 0 0011.586 2H4zm6 6a1 1 0 100-2 1 1 0 000 2zM8 12a1 1 0 100-2 1 1 0 000 2zm2 1a1 1 0 011-1h.01a1 1 0 110 2H11a1 1 0 01-1-1z', clipRule: 'evenodd' })
);

const ProofUploader = ({ goal, onProofImageSubmit, isLoading, goalSetTime, timeLimitInMs, consequence, mustLeaveTime, onMustLeaveTimeUp, onStartEmergency }) => {
  const [proofFiles, setProofFiles] = useState([]);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef(null);
  const [displayGoal, setDisplayGoal] = useState(goal);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [mustLeaveTimeLeft, setMustLeaveTimeLeft] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);

  useEffect(() => {
    if (!goalSetTime || isLoading) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - goalSetTime;
      setElapsedTime(formatCountdown(elapsed > 0 ? elapsed : 0));
    }, 1000);

    const now = Date.now();
    const elapsed = now - goalSetTime;
    setElapsedTime(formatCountdown(elapsed > 0 ? elapsed : 0));

    return () => clearInterval(interval);
  }, [goalSetTime, isLoading]);

  useEffect(() => {
    if (isLoading) return; // Pause timers during verification
    
    let consequenceInterval;
    let mustLeaveInterval;

    if (timeLimitInMs && goalSetTime) {
      const deadline = goalSetTime + timeLimitInMs;

      const checkConsequenceTime = () => {
        const now = Date.now();
        const remaining = deadline - now;

        if (remaining <= 0) {
          setTimeLeft(formatCountdown(0));
          if (!isTimeUp) {
            setIsTimeUp(true);
            const updatedGoal = `Original Goal: "${goal}"\n\nTIME'S UP! Consequence Added: "${consequence}"`;
            setDisplayGoal(updatedGoal);
          }
          return true; // Time is up
        } else {
          setTimeLeft(formatCountdown(remaining));
          return false; // Time is not up
        }
      };

      if (!checkConsequenceTime()) {
        consequenceInterval = window.setInterval(() => {
          if (checkConsequenceTime()) {
            clearInterval(consequenceInterval);
          }
        }, 1000);
      }
    } else {
      setDisplayGoal(goal);
    }
    
    if (mustLeaveTime) {
      const checkMustLeaveTime = () => {
        const now = Date.now();
        const remaining = mustLeaveTime - now;

        if (remaining <= 0) {
          setMustLeaveTimeLeft(formatCountdown(0));
          onMustLeaveTimeUp();
          return true; // Time is up
        } else {
          setMustLeaveTimeLeft(formatCountdown(remaining));
          return false; // Time is not up
        }
      };

      if (!checkMustLeaveTime()) {
        mustLeaveInterval = window.setInterval(() => {
          if (checkMustLeaveTime()) {
            clearInterval(mustLeaveInterval);
          }
        }, 1000);
      }
    }

    return () => {
      if (consequenceInterval) clearInterval(consequenceInterval);
      if (mustLeaveInterval) clearInterval(mustLeaveInterval);
    };
  }, [goal, goalSetTime, timeLimitInMs, consequence, isTimeUp, mustLeaveTime, onMustLeaveTimeUp, isLoading]);

  const addFiles = (newFiles) => {
      const uniqueNewFiles = newFiles.filter(newFile => 
        !proofFiles.some(existingProofFile => 
            existingProofFile.file.name === newFile.name &&
            existingProofFile.file.size === newFile.size &&
            existingProofFile.file.lastModified === newFile.lastModified
        )
      );

      uniqueNewFiles.forEach(file => {
          const isImage = file.type.startsWith('image/');
          if (isImage) {
              const reader = new FileReader();
              reader.onloadend = () => {
                  setProofFiles(prev => [...prev, {
                      id: `${file.name}-${file.lastModified}`,
                      file: file,
                      preview: reader.result,
                      type: 'image',
                  }]);
              };
              reader.readAsDataURL(file);
          } else {
               setProofFiles(prev => [...prev, {
                  id: `${file.name}-${file.lastModified}`,
                  file: file,
                  preview: '', // No preview for PDFs
                  type: 'pdf',
              }]);
          }
      });
  };

  const handleFileChange = (e) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(Array.from(selectedFiles));
    }
  };
  
  const handleCapture = (capturedFile) => {
    addFiles([capturedFile]);
    setShowCamera(false);
  };
  
  const handleRemoveFile = (idToRemove) => {
    setProofFiles(prev => prev.filter(pf => pf.id !== idToRemove));
  };

  const handleSubmit = useCallback(() => {
    if (proofFiles.length > 0) {
      onProofImageSubmit(proofFiles.map(pf => pf.file));
    }
  }, [proofFiles, onProofImageSubmit]);

  const timerElements = [
    React.createElement(
        'div', { key: 'elapsed', className: 'flex-1 min-w-[150px] p-3 rounded-lg border bg-slate-900/50 border-slate-700 text-center' },
        React.createElement('p', { className: 'text-sm text-slate-400 uppercase tracking-wider' }, 'Time Elapsed'),
        React.createElement('p', { className: 'text-3xl font-mono text-cyan-300' }, elapsedTime || '00:00:00')
      ),
  ];

  if (timeLeft) {
    timerElements.push(
      React.createElement(
        'div', { key: 'remaining', className: `flex-1 min-w-[150px] p-3 rounded-lg border ${isTimeUp ? 'bg-red-900/50 border-red-500/50' : 'bg-slate-900/50 border-slate-700'} text-center` },
        React.createElement('p', { className: 'text-sm text-slate-400 uppercase tracking-wider' }, isTimeUp ? "Time's Up!" : 'Time Remaining'),
        React.createElement('p', { className: `text-3xl font-mono ${isTimeUp ? 'text-red-300' : 'text-cyan-300'}` }, timeLeft)
      )
    );
  }
  
  if (mustLeaveTimeLeft) {
    timerElements.push(
        React.createElement(
          'div', { key: 'reveal', className: 'flex-1 min-w-[150px] p-3 rounded-lg border bg-amber-900/50 border-amber-500/50 text-center' },
          React.createElement('p', { className: 'text-sm text-amber-300 uppercase tracking-wider' }, 'Code Reveals In'),
          React.createElement('p', { className: 'text-3xl font-mono text-amber-200' }, mustLeaveTimeLeft)
        )
      );
  }

  return React.createElement(
    React.Fragment,
    null,
    showCamera && React.createElement(CameraCapture, { onCapture: handleCapture, onCancel: () => setShowCamera(false) }),
    React.createElement(
      'div',
      { className: 'bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-center animate-fade-in' },
      React.createElement('h2', { className: 'text-2xl font-semibold mb-2 text-cyan-300' }, 'Your Goal Is Set!'),
      React.createElement(
        'div', { className: 'my-4 flex flex-wrap justify-center gap-4' },
        ...timerElements
      ),
      React.createElement('div', { className: `bg-slate-900/50 p-4 rounded-lg my-6 border ${isTimeUp ? 'border-red-500/50' : 'border-slate-700'}` },
        React.createElement('p', { className: 'text-slate-300 text-lg whitespace-pre-wrap text-left' }, `"${displayGoal}"`)
      ),
      React.createElement('p', { className: 'text-slate-400 mb-6' }, "When you're done, upload pictures or a PDF as proof of completion."),
      React.createElement('input', {
        type: 'file',
        accept: 'image/*,application/pdf',
        onChange: handleFileChange,
        className: 'hidden',
        ref: fileInputRef,
        disabled: isLoading,
        multiple: true
      }),
      React.createElement(
        'div',
        { className: 'border-2 border-dashed border-slate-600 rounded-lg p-4 mb-6 min-h-[120px] flex items-center justify-center' },
        proofFiles.length > 0
          ? React.createElement(
              'div',
              { className: 'grid grid-cols-3 sm:grid-cols-4 gap-2' },
              proofFiles.map((pf) =>
                React.createElement(
                  'div', { key: pf.id, className: 'relative group' },
                  pf.type === 'image'
                    ? React.createElement('img', { src: pf.preview, alt: 'Proof preview', className: 'w-full h-24 object-cover rounded-md' })
                    : React.createElement(
                        'div', { className: 'w-full h-24 bg-slate-700 rounded-md flex flex-col items-center justify-center p-2' },
                        React.createElement(PDFIcon, null),
                        React.createElement('span', { className: 'text-xs text-slate-300 break-all text-center overflow-hidden line-clamp-2 mt-1' }, pf.file.name)
                      ),
                  React.createElement(
                    'button',
                    { onClick: () => handleRemoveFile(pf.id), className: 'absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 leading-none opacity-0 group-hover:opacity-100 transition-opacity', 'aria-label': 'Remove file' },
                    React.createElement(
                      'svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: '2' },
                      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M6 18L18 6M6 6l12 12' })
                    )
                  )
                )
              )
            )
          : React.createElement('p', { className: 'text-slate-500' }, 'Your proof images and PDFs will appear here.')
      ),
      React.createElement(
        'div', { className: 'flex flex-col sm:flex-row gap-4 mb-6' },
        React.createElement('button', { onClick: () => fileInputRef.current?.click(), disabled: isLoading, className: 'flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center' }, 'Add from Files'),
        React.createElement('button', { onClick: () => setShowCamera(true), disabled: isLoading, className: 'flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center' }, 'Add with Camera')
      ),
      React.createElement(
        'button',
        { onClick: handleSubmit, disabled: proofFiles.length === 0 || isLoading, className: 'w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center' },
        isLoading ? React.createElement(React.Fragment, null, React.createElement(Spinner, null), React.createElement('span', {className: 'ml-2'}, 'Verifying...')) : 'Submit Proof for Verification'
      ),
      React.createElement(
        'div',
        { className: 'mt-8 text-center' },
        React.createElement(
            'button',
            {
                onClick: onStartEmergency,
                disabled: isLoading,
                className: 'text-sm text-slate-500 hover:text-red-400 transition-colors duration-300 flex items-center justify-center gap-2 mx-auto'
            },
            React.createElement(
                'svg', 
                { xmlns: 'http://www.w3.org/2000/svg', className: 'h-4 w-4', viewBox: '0 0 20 20', fill: 'currentColor' },
                React.createElement('path', { fillRule: 'evenodd', d: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z', clipRule: 'evenodd' })
            ),
            'Need your code back now? Try the Emergency Exit.'
        )
      )
    )
  );
};

export default ProofUploader;
