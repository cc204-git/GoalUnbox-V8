import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dataURLtoFile } from '../utils/fileUtils.js';
import Spinner from './Spinner.js';

const CameraCapture = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const startCamera = async () => {
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
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
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

  const handleRetake = () => {
    setCapturedImage(null);
    setIsLoading(true);
    const startCamera = async () => {
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
        setError("Could not access the camera.");
      } finally {
        setIsLoading(false);
      }
    };
    startCamera();
  };

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
        onCanPlay: () => setIsLoading(false),
      }),
      React.createElement('canvas', { ref: canvasRef, className: 'hidden' }),
      capturedImage && React.createElement('img', { src: capturedImage, alt: 'Captured', className: 'w-full h-full object-contain' })
    ),
    React.createElement(
      'div',
      { className: 'mt-6 flex gap-4' },
      !capturedImage
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement('button', { onClick: handleCapture, disabled: isLoading || !!error, className: 'bg-cyan-500 text-slate-900 font-bold py-3 px-6 rounded-lg hover:bg-cyan-400 transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed' }, 'Capture'),
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
