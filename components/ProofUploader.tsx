
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
  mustLeaveTime: number | null;
  onMustLeaveTimeUp: () => void;
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


const ProofUploader: React.FC<ProofUploaderProps> = ({ goal, onProofImageSubmit, isLoading, goalSetTime, timeLimitInMs, consequence, mustLeaveTime, onMustLeaveTimeUp }) => {
  const [proofFiles, setProofFiles] = useState<ProofFile[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayGoal, setDisplayGoal] = useState(goal);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [mustLeaveTimeLeft, setMustLeaveTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    let consequenceInterval: number | undefined;
    let mustLeaveInterval: number | undefined;

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
    
    // Must Leave Timer Logic
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
  }, [goal, goalSetTime, timeLimitInMs, consequence, isTimeUp, mustLeaveTime, onMustLeaveTimeUp]);


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
      <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-lg text-center animate-fade-in">
        <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Your Goal Is Set!</h2>
        
        {mustLeaveTimeLeft && (
            <div className="my-4 p-3 rounded-lg border bg-amber-900/50 border-amber-500/50">
                <p className="text-sm text-amber-300 uppercase tracking-wider">Code Reveals In</p>
                <p className="text-3xl font-mono text-amber-200">{mustLeaveTimeLeft}</p>
            </div>
        )}

        {timeLeft && (
            <div className={`my-4 p-3 rounded-lg border ${isTimeUp ? 'bg-red-900/50 border-red-500/50' : 'bg-slate-900/50 border-slate-700'}`}>
                <p className="text-sm text-slate-400 uppercase tracking-wider">{isTimeUp ? "Time's Up!" : 'Time Remaining'}</p>
                <p className={`text-3xl font-mono ${isTimeUp ? 'text-red-300' : 'text-cyan-300'}`}>{timeLeft}</p>
            </div>
        )}
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
      </div>
    </>
  );
};

export default ProofUploader;
