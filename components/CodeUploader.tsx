import React, { useState, useCallback, useRef } from 'react';
import Spinner from './Spinner';
import CameraCapture from './CameraCapture';
import DailyCommitment from './DailyCommitment';
import { StreakData } from '../types';

interface CodeUploaderProps {
  onCodeImageSubmit: (file: File) => void;
  isLoading: boolean;
  onShowHistory: () => void;
  onLogout: () => void;
  currentUser: any | null; // Firebase user object
  streakData: StreakData | null;
  onSetCommitment: (text: string) => void;
  onCompleteCommitment: () => void;
}

const CodeUploader: React.FC<CodeUploaderProps> = ({ 
    onCodeImageSubmit, 
    isLoading, 
    onShowHistory, 
    onLogout, 
    currentUser,
    streakData,
    onSetCommitment,
    onCompleteCommitment,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };
  
  const handleCapture = (capturedFile: File) => {
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

  return (
    <div className="relative w-full max-w-md flex flex-col items-center">
      {showCamera && <CameraCapture onCapture={handleCapture} onCancel={() => setShowCamera(false)} />}
      <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center animate-fade-in">
        
        <div className="absolute top-4 right-4 flex items-center gap-2">
            {currentUser && !currentUser.isAnonymous && (
                 <button
                    onClick={onLogout}
                    className="text-slate-500 hover:text-red-400 transition-colors p-2"
                    aria-label="Logout"
                    title="Logout"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            )}
            <button
                onClick={onShowHistory}
                className="text-slate-500 hover:text-cyan-400 transition-colors p-2"
                aria-label="View goal history"
                title="View Goal History"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </button>
        </div>

        {currentUser && !currentUser.isAnonymous && <p className="text-sm text-slate-500 mb-6 -mt-2 text-left">Logged in as: <strong>{currentUser.email}</strong></p>}
        {currentUser && currentUser.isAnonymous && <p className="text-sm text-slate-500 mb-6 -mt-2 text-left">Logged in as: <strong>Guest</strong></p>}

        <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Step 1: Sequester Your Code</h2>
        <p className="text-slate-400 mb-6">Take a picture of the 3-digit code on your lock box. The code will be hidden until your goal is complete.</p>
        
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={isLoading}
        />

        <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 mb-6 hover:border-cyan-400 transition-colors duration-300 min-h-[150px] flex items-center justify-center">
            {file ? (
                <div className="flex flex-col items-center justify-center gap-4 text-green-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="font-semibold">Image Received. The code is now hidden.</p>
                    <p className="text-sm text-slate-400">{file.name}</p>
                     <button
                        onClick={handleSelectFileClick}
                        disabled={isLoading}
                        className="text-sm text-cyan-400 hover:text-cyan-300"
                    >
                        Change file
                    </button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center gap-4">
                    <p className="text-slate-500">Upload a picture of your code:</p>
                    <div className="flex gap-4">
                        <button
                            onClick={handleSelectFileClick}
                            disabled={isLoading}
                            className="bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Select File
                        </button>
                          <button
                            onClick={() => setShowCamera(true)}
                            disabled={isLoading}
                            className="bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors"
                        >
                            Take Photo
                        </button>
                    </div>
                </div>
            )}
        </div>


        <button
          onClick={handleSubmit}
          disabled={!file || isLoading}
          className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
          {isLoading ? <Spinner /> : 'Analyze & Save Code'}
        </button>
      </div>

      {currentUser && !currentUser.isAnonymous && streakData && (
        <DailyCommitment
            streakData={streakData}
            onSetCommitment={onSetCommitment}
            onCompleteCommitment={onCompleteCommitment}
        />
      )}
    </div>
  );
};

export default CodeUploader;