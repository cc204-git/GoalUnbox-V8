
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Spinner from './Spinner';
import CameraCapture from './CameraCapture';
import { formatCountdown } from '../utils/timeUtils';

interface ProofUploaderProps {
  goal: string;
  onProofImageSubmit: (files: File[]) => void;
  isLoading: boolean;
  goalSetTime: number | null;
  timeLimitInMs: number | null;
  consequence: string | null;
  onSkipGoal: () => void;
  skipsLeftThisWeek: number;
  lastCompletedCodeImage?: string | null;
}

interface ProofFile {
    id: string;
    file: File;
    preview: string;
    type: 'image' | 'pdf';
}

const PDFIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.414a1 1 0 00-.293-.707l-4.414-4.414A1 1 0 0011.586 2H4zm6 6a1 1 0 100-2 1 1 0 000 2zM8 12a1 1 0 100-2 1 1 0 000 2zm2 1a1 1 0 011-1h.01a1 1 0 110 2H11a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);


const ProofUploader: React.FC<ProofUploaderProps> = ({ goal, onProofImageSubmit, isLoading, goalSetTime, timeLimitInMs, consequence, onSkipGoal, skipsLeftThisWeek, lastCompletedCodeImage }) => {
  const [proofFiles, setProofFiles] = useState<ProofFile[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayGoal, setDisplayGoal] = useState(goal);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);
  const [showPreviousCodeModal, setShowPreviousCodeModal] = useState(false);

  // Effect for the elapsed time count-up timer
  useEffect(() => {
    if (!goalSetTime || isLoading) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - goalSetTime;
      setElapsedTime(formatCountdown(elapsed > 0 ? elapsed : 0));
    }, 1000);

    // Set initial value immediately to avoid 1s delay
    const now = Date.now();
    const elapsed = now - goalSetTime;
    setElapsedTime(formatCountdown(elapsed > 0 ? elapsed : 0));

    return () => clearInterval(interval);
  }, [goalSetTime, isLoading]);

  // Effect for countdowns and consequences
  useEffect(() => {
    if (isLoading) return; // Pause timers during verification

    let consequenceInterval: number | undefined;

    // Consequence Timer Logic
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
    
    return () => {
      if (consequenceInterval) clearInterval(consequenceInterval);
    };
  }, [goal, goalSetTime, timeLimitInMs, consequence, isTimeUp, isLoading]);


  const addFiles = (newFiles: File[]) => {
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
                      preview: reader.result as string,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(Array.from(selectedFiles));
    }
  };
  
  const handleCapture = (capturedFile: File) => {
    addFiles([capturedFile]);
    setShowCamera(false);
  };
  
  const handleRemoveFile = (idToRemove: string) => {
    setProofFiles(prev => prev.filter(pf => pf.id !== idToRemove));
  };

  const handleSubmit = useCallback(() => {
    if (proofFiles.length > 0) {
      onProofImageSubmit(proofFiles.map(pf => pf.file));
    }
  }, [proofFiles, onProofImageSubmit]);

  return (
    <>
      {showCamera && <CameraCapture onCapture={handleCapture} onCancel={() => setShowCamera(false)} />}
      <div className="relative bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-2xl text-center animate-fade-in">
        <button
            onClick={() => setShowPreviousCodeModal(true)}
            disabled={isLoading || !lastCompletedCodeImage}
            className="absolute top-4 right-4 text-sm text-slate-400 hover:text-cyan-400 transition-colors duration-300 flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-900/50 hover:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:hover:bg-slate-900/50"
            title={!lastCompletedCodeImage ? "No previous code available" : "View Previous Code"}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>View Previous Code</span>
        </button>

        <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Your Goal Is Set!</h2>
        
        <div className="my-4 flex flex-wrap justify-center gap-4">
            <div className="flex-1 min-w-[150px] p-3 rounded-lg border bg-slate-900/50 border-slate-700 text-center">
                <p className="text-sm text-slate-400 uppercase tracking-wider">Time Elapsed</p>
                <p className="text-3xl font-mono text-cyan-300">{elapsedTime || '00:00:00'}</p>
            </div>

            {timeLeft && (
                <div className={`flex-1 min-w-[150px] p-3 rounded-lg border ${isTimeUp ? 'bg-red-900/50 border-red-500/50' : 'bg-slate-900/50 border-slate-700'} text-center`}>
                    <p className="text-sm text-slate-400 uppercase tracking-wider">{isTimeUp ? "Time's Up!" : 'Time Remaining'}</p>
                    <p className={`text-3xl font-mono ${isTimeUp ? 'text-red-300' : 'text-cyan-300'}`}>{timeLeft}</p>
                </div>
            )}
        </div>
        
        <div className={`bg-slate-900/50 p-4 rounded-lg my-6 border ${isTimeUp ? 'border-red-500/50' : 'border-slate-700'}`}>
          <p className="text-slate-300 text-lg whitespace-pre-wrap text-left">"{displayGoal}"</p>
        </div>

        <p className="text-slate-400 mb-6">When you're done, upload pictures or a PDF as proof of completion.</p>

        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={isLoading}
          multiple
        />

        <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 mb-6 min-h-[120px] flex items-center justify-center">
            {proofFiles.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {proofFiles.map((pf) => (
                    <div key={pf.id} className="relative group">
                        {pf.type === 'image' ? (
                            <img src={pf.preview} alt={`Proof preview`} className="w-full h-24 object-cover rounded-md" />
                        ) : (
                            <div className="w-full h-24 bg-slate-700 rounded-md flex flex-col items-center justify-center p-2">
                                <PDFIcon />
                                <span className="text-xs text-slate-300 break-all text-center overflow-hidden line-clamp-2 mt-1">{pf.file.name}</span>
                            </div>
                        )}
                        <button 
                            onClick={() => handleRemoveFile(pf.id)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove file"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
            ) : (
            <p className="text-slate-500">Your proof images and PDFs will appear here.</p>
            )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center"
            >
                Add from Files
            </button>
            <button
                onClick={() => setShowCamera(true)}
                disabled={isLoading}
                className="flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center"
            >
                Add with Camera
            </button>
        </div>


        <button
          onClick={handleSubmit}
          disabled={proofFiles.length === 0 || isLoading}
          className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          {isLoading ? <><Spinner /><span className="ml-2">Verifying...</span></> : 'Submit Proof for Verification'}
        </button>

        <div className="mt-8 text-center flex items-center justify-center gap-6">
            <div className="flex flex-col items-center">
                <button
                    onClick={onSkipGoal}
                    disabled={isLoading || skipsLeftThisWeek <= 0}
                    className="text-sm text-slate-500 hover:text-amber-400 transition-colors duration-300 flex items-center justify-center gap-2 disabled:text-slate-600 disabled:hover:text-slate-600 disabled:cursor-not-allowed"
                    title={skipsLeftThisWeek > 0 ? `Skip this goal. You have ${skipsLeftThisWeek} skips left this week.` : 'You have no skips left for this week.'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
                    </svg>
                    Skip Goal
                </button>
                 <span className={`text-xs mt-1 ${skipsLeftThisWeek > 0 ? 'text-slate-500' : 'text-red-500/80'}`}>
                    ({skipsLeftThisWeek} left this week)
                </span>
            </div>
        </div>
      </div>
       {showPreviousCodeModal && lastCompletedCodeImage && (
            <div 
                className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4"
                onClick={() => setShowPreviousCodeModal(false)}
            >
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <p className="text-white text-center mb-2 font-semibold">Code from Previous Goal</p>
                    <img
                      src={lastCompletedCodeImage}
                      alt="Sequestered code from previous goal"
                      className="rounded-lg max-h-[80vh] max-w-[90vw] object-contain"
                    />
                    <button
                        onClick={() => setShowPreviousCodeModal(false)}
                        className="absolute -top-3 -right-3 bg-slate-800 text-white rounded-full p-1.5 leading-none hover:bg-slate-700 transition-colors"
                        aria-label="Close image view"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        )}
    </>
  );
};

export default ProofUploader;
