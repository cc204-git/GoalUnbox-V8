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

type ModalStage = 'main' | 'show-code' | 'scan-qr' | 'enter-code' | 'importing';

const DataSyncModal: React.FC<DataSyncModalProps> = ({ onClose }) => {
    const [stage, setStage] = useState<ModalStage>('main');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [syncCode, setSyncCode] = useState<string | null>(null);
    const [pastedCode, setPastedCode] = useState('');
    const [copyButtonText, setCopyButtonText] = useState('Copy Code');
    const qrCodeRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Generate QR code and text code when the component enters the 'show-code' stage
    useEffect(() => {
        if (stage === 'show-code') {
            const dataString = exportDataToString();
            if (dataString) {
                setSyncCode(dataString);
                if (qrCodeRef.current) {
                    qrCodeRef.current.innerHTML = '';
                    const qr = qrcode(0, 'L');
                    qr.addData(dataString);
                    qr.make();
                    const imgTag = qr.createImgTag(4, 4);
                    qrCodeRef.current.innerHTML = imgTag;
                    const imgElement = qrCodeRef.current.querySelector('img');
                    if (imgElement) {
                        imgElement.style.width = '100%';
                        imgElement.style.height = 'auto';
                        imgElement.style.imageRendering = 'pixelated'; // Keep pixels sharp
                    }
                }
            } else {
                setError("No data found to export.");
                setStage('main');
            }
        }
    }, [stage]);
    
    const handleCopyCode = useCallback(() => {
        if (syncCode) {
            navigator.clipboard.writeText(syncCode).then(() => {
                setCopyButtonText('Copied!');
                setTimeout(() => setCopyButtonText('Copy Code'), 2000);
            }, () => {
                setError('Failed to copy code to clipboard.');
            });
        }
    }, [syncCode]);

    const handleImportData = useCallback(async (data: string) => {
        if (!data.trim()) return;
        
        if (!confirm("Importing data will overwrite all existing user accounts and history in this browser. Are you sure you want to continue?")) {
            setStage('main');
            return;
        }
        
        setStage('importing');
        setError(null);
        setMessage(null);
        
        try {
            await new Promise(res => setTimeout(res, 500));
            const successMessage = await importDataFromString(data);
            setMessage(successMessage);
            setTimeout(() => window.location.reload(), 2000);
        } catch (e) {
            setError(e instanceof Error ? e.message : "An unknown error occurred during import.");
            setStage('main');
        }
    }, []);

    const handleDownloadFile = useCallback(() => {
        const dataString = exportDataToString();
        if (dataString) {
            const blob = new Blob([dataString], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `goal-unbox-sync-${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            setError("No data found to export.");
        }
    }, []);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    handleImportData(text);
                } else {
                    setError('Failed to read the sync file.');
                }
            };
            reader.onerror = () => {
                setError('Error reading the selected file.');
            };
            reader.readAsText(file);
        }
        if (event.target) {
            event.target.value = '';
        }
    };


    const renderMainView = () => (
        <>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Account & Data Sync</h2>
            <p className="text-slate-400 mb-6">Move your data between devices.</p>
            {error && <Alert message={error} type="error" />}
            
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,text/plain"
                onChange={handleFileSelected}
            />

            <p className="font-semibold text-left mb-2 text-slate-300">On your OLD device:</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                    onClick={() => setStage('show-code')}
                    className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center gap-2 text-center"
                >
                    1a. Show QR/Text Code
                </button>
                 <button
                    onClick={handleDownloadFile}
                    className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center gap-2 text-center"
                >
                    1b. Download File
                </button>
            </div>

            <p className="font-semibold text-left mb-2 text-slate-300">On your NEW device:</p>
            <div className="space-y-4">
                 <button
                    onClick={() => setStage('scan-qr')}
                    className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300"
                >
                    2a. Scan QR Code
                </button>
                 <button
                    onClick={() => setStage('enter-code')}
                    className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300"
                >
                    2b. Enter Sync Code
                </button>
                <button
                    onClick={handleUploadClick}
                    className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300"
                >
                    2c. Upload Sync File
                </button>
            </div>
             <p className="text-xs text-amber-400/80 mt-6">
                <span className="font-bold">Important:</span> Your API Key is not synced for security.
            </p>
        </>
    );

    const renderShowCodeView = () => (
         <>
            <button onClick={() => setStage('main')} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
            </button>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Your Sync Code</h2>
            <p className="text-slate-400 mb-4">On your new device, either scan this QR code or enter the text code below.</p>
            <div ref={qrCodeRef} className="bg-white p-2 sm:p-4 rounded-lg flex justify-center items-center max-w-xs mx-auto"></div>
            <div className="mt-4">
                <textarea
                    readOnly
                    value={syncCode || ''}
                    className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-2 text-xs font-mono text-slate-300 select-all"
                    aria-label="Synchronization Code"
                />
                <button
                    onClick={handleCopyCode}
                    className="w-full mt-2 bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors"
                >
                    {copyButtonText}
                </button>
            </div>
        </>
    );

    const renderEnterCodeView = () => (
        <>
            <button onClick={() => setStage('main')} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
            </button>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Enter Sync Code</h2>
            <p className="text-slate-400 mb-4">Paste the code from your other device here.</p>
            <textarea
                value={pastedCode}
                onChange={(e) => setPastedCode(e.target.value)}
                placeholder="Paste sync code here..."
                className="w-full h-32 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500"
                aria-label="Paste sync code here"
            />
            <button
                onClick={() => handleImportData(pastedCode)}
                disabled={!pastedCode.trim()}
                className="w-full mt-4 bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
                Import Data
            </button>
        </>
    );

    const renderImportingView = () => (
        <>
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Importing Data...</h2>
            <div className="flex flex-col items-center gap-4 my-8">
                <Spinner />
                {message ? <Alert message={message} type="info" /> : <p>Applying changes, please wait.</p>}
            </div>
        </>
    );

    const renderContent = () => {
        switch (stage) {
            case 'show-code': return renderShowCodeView();
            case 'scan-qr': return null; // Handled by separate full-screen component
            case 'enter-code': return renderEnterCodeView();
            case 'importing': return renderImportingView();
            case 'main':
            default: return renderMainView();
        }
    }

    return (
        <>
        {stage === 'scan-qr' && (
            <QrScanner onScanSuccess={handleImportData} onCancel={() => setStage('main')} />
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