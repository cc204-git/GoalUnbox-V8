import React, { useState, useEffect, useRef, useCallback } from 'react';
import { exportDataToString, importDataFromString } from '../utils/dataSyncUtils';
import Spinner from './Spinner';
import Alert from './Alert';
import QrScanner from './QrScanner';

// Declare the qrcode library loaded from the CDN
declare var qrcode: any;

interface DataSyncModalProps {
  onClose: () => void;
}

type ModalStage = 'main' | 'show-qr' | 'scan-qr' | 'importing';

const DataSyncModal: React.FC<DataSyncModalProps> = ({ onClose }) => {
    const [stage, setStage] = useState<ModalStage>('main');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const qrCodeRef = useRef<HTMLDivElement>(null);

    // Generate QR code when the ref is available
    useEffect(() => {
        if (stage === 'show-qr' && qrCodeRef.current) {
            const dataString = exportDataToString();
            if (dataString) {
                // Clear previous QR code
                qrCodeRef.current.innerHTML = '';
                // Generate new one
                const typeNumber = 0; // auto-detect
                const errorCorrectionLevel = 'L';
                const qr = qrcode(typeNumber, errorCorrectionLevel);
                qr.addData(dataString);
                qr.make();
                // createImgTag(cellSize, margin) - create a smaller image to fit more data
                const imgTag = qr.createImgTag(4, 4);
                qrCodeRef.current.innerHTML = imgTag;
                // Style the generated image
                const imgElement = qrCodeRef.current.querySelector('img');
                if (imgElement) {
                    imgElement.style.width = '100%';
                    imgElement.style.height = 'auto';
                }
            } else {
                setError("No data found to export.");
                setStage('main');
            }
        }
    }, [stage]);


    const handleScanSuccess = useCallback(async (data: string) => {
        setStage('importing');
        setError(null);
        setMessage(null);

        if (!confirm("Importing data will overwrite all existing user accounts and history in this browser. Are you sure you want to continue?")) {
            setStage('main');
            return;
        }
        
        try {
            // Add a small delay for user feedback
            await new Promise(res => setTimeout(res, 500));
            const successMessage = await importDataFromString(data);
            setMessage(successMessage);
            setTimeout(() => window.location.reload(), 2000); // Reload to apply changes
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unknown error occurred during import.");
            setStage('main');
        }
    }, []);

    const renderMainView = () => (
        <>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Account & Data Sync</h2>
            <p className="text-slate-400 mb-6">
                Use QR codes to easily move your data between devices.
            </p>
            <p className="text-xs text-amber-400/80 mb-6">
                <span className="font-bold">Important:</span> Your Gemini API Key is <span className="underline">not</span> synced for security reasons. You must enter it separately on each device.
            </p>

            {error && <Alert message={error} type="error" />}

            <div className="space-y-4">
                 <button
                    onClick={() => setStage('show-qr')}
                    className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center gap-2"
                >
                    Show Sync QR Code (On old device)
                </button>

                 <button
                    onClick={() => setStage('scan-qr')}
                    className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300 flex items-center justify-center gap-2"
                >
                    Scan QR Code (On new device)
                </button>
            </div>
        </>
    );

    const renderShowQrView = () => (
         <>
            <button 
                onClick={() => setStage('main')} 
                className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-2"
            >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
            </button>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Your Sync Code</h2>
            <p className="text-slate-400 mb-4">Scan this QR code with your other device to transfer your account data.</p>
            <div ref={qrCodeRef} className="bg-white p-2 sm:p-4 rounded-lg flex justify-center items-center max-w-xs mx-auto">
                {/* QR Code will be rendered here by the useEffect hook */}
            </div>
        </>
    );

    const renderImportingView = () => (
        <>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Importing Data...</h2>
            <div className="flex flex-col items-center gap-4 my-8">
                <Spinner />
                {message ? (
                    <Alert message={message} type="info" />
                ) : (
                    <p>Applying changes, please wait.</p>
                )}
            </div>
        </>
    )

    const renderContent = () => {
        switch (stage) {
            case 'show-qr':
                return renderShowQrView();
            case 'scan-qr':
                // This is a full screen component, so it will be rendered outside the modal box
                return null;
            case 'importing':
                return renderImportingView();
            case 'main':
            default:
                return renderMainView();
        }
    }

    return (
        <>
        {stage === 'scan-qr' && (
            <QrScanner onScanSuccess={handleScanSuccess} onCancel={() => setStage('main')} />
        )}
        <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4 ${stage === 'scan-qr' ? 'hidden' : ''}`} onClick={onClose}>
            <div 
                className="bg-slate-800 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center relative"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
                    aria-label="Close"
                    disabled={stage === 'importing'}
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {renderContent()}
            </div>
        </div>
        </>
    );
};

export default DataSyncModal;