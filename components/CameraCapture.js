import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dataURLtoFile } from '../utils/fileUtils.js';
import { formatCountdown } from '../utils/timeUtils.js';
import Spinner from './Spinner.js';

const CameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(120);
  const [timerFailed, setTimerFailed] = useState(false);
  const timerIntervalRef = useRef(null);
  const [isStreamActive, setIsStreamActive] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreamActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setCapturedImage(null);
    setTimerFailed(false);

    if (streamRef.current) {
        stopStream();
    }
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsStreamActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Could not access the camera. Please ensure you have given permission and are not using it elsewhere.");
      setIsStreamActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return () => {
      stopStream();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [startCamera, stopStream]);

  useEffect(() => {
    if (!isStreamActive || capturedImage || timerFailed) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    
    setTimeLeft(120);
    
    timerIntervalRef.current = window.setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          setTimerFailed(true);
          stopStream();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isStreamActive, capturedImage, timerFailed, stopStream]);

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
        stopStream();
      }
    }
  }, [stopStream]);

  const handleConfirm = () => {
    if (capturedImage) {
      const file = dataURLtoFile(capturedImage, `capture-${Date.now()}.jpg`);
      if (file) {
        onCapture(file);
      }
    }
  };
  
  const handleTryAgain = () => {
      startCamera();
  };

  const handleRetake = () => {
    startCamera();
  };

  if (timerFailed) {
      return React.createElement(
         'div', { className: "fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4 text-center" },
         React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-20 w-20 text-red-500", viewBox: "0 0 20 20", fill: "currentColor" },
            React.createElement('path', { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.414L11 9.586V6z", clipRule: "evenodd" })
         ),
         React.createElement('h2', { className: "text-2xl font-semibold mt-4 text-red-400" }, "Time's Up!"),
         React.createElement('p', { className: "text-slate-300 mt-2" }, "You ran out of time to take the photo."),
         React.createElement('div', { className: "mt-6 flex gap-4" },
             React.createElement('button', { onClick: handleTryAgain, className: "bg-cyan-500 text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-cyan-400 transition-colors" }, "Try Again"),
             React.createElement('button', { onClick: onCancel, className: "bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors" }, "Cancel")
         )
      );
  }

  return React.createElement(
    'div',
    { className: 'fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4' },
    error && React.createElement('div', { className: 'text-red-400 bg-red-900/50 p-4 rounded-md mb-4' }, error),
    isLoading && React.createElement(Spinner, null),
    React.createElement(
      'div',
      { className: 'relative w-full max-w-2xl aspect-video bg-black rounded-lg overflow-hidden' },
      React.createElement('video', {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        className: `w-full h-full object-contain ${capturedImage ? 'hidden' : 'block'}`,
        onCanPlay: () => !isLoading && setIsLoading(false),
      }),
      React.createElement('canvas', { ref: canvasRef, className: 'hidden' }),
      capturedImage && React.createElement('img', { src: capturedImage, alt: 'Captured', className: 'w-full h-full object-contain' }),
      !capturedImage && !isLoading && isStreamActive && React.createElement('div', { className: "absolute top-2 left-1/2 -translate-x-1/2 bg-black/60 text-white font-mono text-lg py-1 px-3 rounded-full" },
          formatCountdown(timeLeft * 1000).substring(3)
      )
    ),
    React.createElement(
      'div',
      { className: 'mt-6 flex gap-4' },
      !capturedImage
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement('button', { onClick: handleCapture, disabled: isLoading || !!error || !isStreamActive, className: 'bg-cyan-500 text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-cyan-400 transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed' }, 'Capture'),
            React.createElement('button', { onClick: onCancel, className: 'bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors' }, 'Cancel')
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement('button', { onClick: handleConfirm, className: 'bg-green-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-400 transition-colors' }, 'Use Photo'),
            React.createElement('button', { onClick: handleRetake, className: 'bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors' }, 'Retake')
          )
    )
  );
};

export default CameraCapture;