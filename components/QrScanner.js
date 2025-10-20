import React, { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner.js';
import Alert from './Alert.js';


const QrScannerComponent = ({ onScanSuccess, onCancel }) => {
    const videoRef = useRef(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!videoRef.current) return;

        let scanner;

        const startScanner = async () => {
            try {
                scanner = new QrScanner(
                    videoRef.current,
                    (result) => {
                        scanner.stop();
                        onScanSuccess(result.data);
                    },
                    {
                        onDecodeError: (err) => {},
                        highlightScanRegion: true,
                        highlightCodeOutline: true,
                    }
                );

                await scanner.start();
                setIsLoading(false);

            } catch (err) {
                console.error("QR Scanner error:", err);
                let message = "Could not start the camera. ";
                 if (err?.name === 'NotAllowedError' || err === 'Camera not found.') {
                    message += "Please grant camera permissions in your browser settings.";
                } else if (typeof err === 'string' && err.includes('not found')) {
                     message += "No camera found on this device."
                }
                else {
                    message += "Please ensure it's not being used by another application.";
                }
                setError(message);
                setIsLoading(false);
            }
        };

        startScanner();

        return () => {
            if (scanner) {
                scanner.stop();
                scanner.destroy();
            }
        };
    }, [onScanSuccess]);

    return React.createElement(
        'div', { className: "fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4" },
        React.createElement('h2', { className: "text-2xl font-semibold mb-4 text-white" }, "Scan Sync Code"),
        React.createElement(
            'div', { className: "relative w-full max-w-lg aspect-square bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center" },
            isLoading && React.createElement(Spinner, null),
            error && React.createElement('div', { className: "p-4 text-center" }, React.createElement(Alert, { message: error, type: "error" })),
            React.createElement('video', { ref: videoRef, className: `w-full h-full object-cover ${isLoading || error ? 'hidden' : 'block'}` }),
            React.createElement('div', { className: "absolute inset-0 border-8 border-white/20 rounded-lg pointer-events-none" })
        ),
        React.createElement('button', { onClick: onCancel, className: "mt-6 bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors" }, "Cancel")
    );
};

export default QrScannerComponent;
