import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dataURLtoFile } from '../utils/fileUtils';
import { formatCountdown } from '../utils/timeUtils';
import Spinner from './Spinner';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New state for the timer
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes in seconds
  const [timerFailed, setTimerFailed] = useState(false);
  const timerIntervalRef = useRef<number | null>(null);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access the camera. Please ensure you have given permission and are not using it elsewhere.");
    } finally {
      setIsLoading(false);
    }
  }, [stream]);

  // Effect to start camera on mount
  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Effect for the countdown timer
  useEffect(() => {
    if (capturedImage || timerFailed || isLoading || !stream) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    
    setTimeLeft(120); // Reset timer each time a new stream is ready
    
    timerIntervalRef.current = window.setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setTimerFailed(true);
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          setStream(null);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [stream, capturedImage, timerFailed, isLoading]);


  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  }, [stream]);

  const handleConfirm = () => {
    if (capturedImage) {
      const file = dataURLtoFile(capturedImage, `capture-${Date.now()}.jpg`);
      if (file) {
        onCapture(file);
      }
    }
  };
  
  const handleTryAgain = () => {
      setTimerFailed(false);
      setCapturedImage(null);
      startCamera();
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };
  
  if (timerFailed) {
      return (
         <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <h2 className="text-2xl font-semibold mt-4 text-red-400">Time's Up!</h2>
            <p className="text-slate-300 mt-2">You ran out of time to take the photo.</p>
            <div className="mt-6 flex gap-4">
                <button onClick={handleTryAgain} className="bg-cyan-500 text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-cyan-400 transition-colors button-glow-cyan">
                    Try Again
                </button>
                <button onClick={onCancel} className="bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors">
                    Cancel
                </button>
            </div>
         </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4">
        {error && <div className="text-red-400 bg-red-900/50 p-4 rounded-md mb-4">{error}</div>}
        
        {isLoading && <Spinner />}

        <div className="relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-contain ${capturedImage ? 'hidden' : 'block'}`}
                onCanPlay={() => setIsLoading(false)}
            />
            <canvas ref={canvasRef} className="hidden" />
            {capturedImage && (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            )}
            {!capturedImage && !isLoading && stream && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white font-mono text-lg py-1 px-3 rounded-full">
                   {formatCountdown(timeLeft * 1000).substring(3)}
                </div>
            )}
        </div>

        <div className="mt-6 flex gap-4">
            {!capturedImage ? (
                <>
                    <button onClick={handleCapture} disabled={isLoading || !!error} className="bg-cyan-500 text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-cyan-400 transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed button-glow-cyan">
                        Capture
                    </button>
                    <button onClick={onCancel} className="bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors">
                        Cancel
                    </button>
                </>
            ) : (
                 <>
                    <button onClick={handleConfirm} className="bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-400 transition-colors">
                        Use Photo
                    </button>
                    <button onClick={handleRetake} className="bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors">
                        Retake
                    </button>
                </>
            )}
        </div>
    </div>
  );
};

export default CameraCapture;