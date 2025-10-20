import React, { useEffect, useRef, useState } from 'react';
import Spinner from './Spinner';
import Alert from './Alert';

// Declare the QrScanner library loaded from the CDN
declare var QrScanner: any;

interface QrScannerProps {
    onScanSuccess: (data: string) => void;
    onCancel: () => void;
}

const QrScannerComponent: React.FC<QrScannerProps> = ({ onScanSuccess, onCancel }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!videoRef.current) return;

        let scanner: any;

        const startScanner = async () => {
            try {
                // The library checks for permissions internally and will throw an error if denied.
                scanner = new QrScanner(
                    videoRef.current,
                    (result: { data: string }) => {
                        scanner.stop();
                        onScanSuccess(result.data);
                    },
                    {
                        onDecodeError: (err: any) => {
                            // This can be noisy, so we don't log every failed scan attempt.
                        },
                        highlightScanRegion: true,
                        highlightCodeOutline: true,
                    }
                );

                await scanner.start();
                setIsLoading(false);

            } catch (err: any) {
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
                // Ensure scanner is stopped and resources are released on component unmount
                scanner.stop();
                scanner.destroy();
            }
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 animate-fade-in p-4">
            <h2 className="text-2xl font-semibold mb-4 text-white">Scan Sync Code</h2>
            <div className="relative w-full max-w-lg aspect-square bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                {isLoading && <Spinner />}
                {error && <div className="p-4 text-center"><Alert message={error} type="error" /></div>}
                <video ref={videoRef} className={`w-full h-full object-cover ${isLoading || error ? 'hidden' : 'block'}`}></video>
                 <div className="absolute inset-0 border-8 border-white/20 rounded-lg pointer-events-none"></div>
            </div>
            <button onClick={onCancel} className="mt-6 bg-slate-700 text-white font-bold py-3 px-6 rounded-lg hover:bg-slate-600 transition-colors">
                Cancel
            </button>
        </div>
    );
};

export default QrScannerComponent;
