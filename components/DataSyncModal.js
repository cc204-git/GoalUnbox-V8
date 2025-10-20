import React, { useState, useEffect, useRef, useCallback } from 'react';
import { exportDataToString, importDataFromString } from '../utils/dataSyncUtils.js';
import Spinner from './Spinner.js';
import Alert from './Alert.js';
import QrScanner from './QrScanner.js';


const DataSyncModal = ({ onClose }) => {
    const [stage, setStage] = useState('main');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const qrCodeRef = useRef(null);

    useEffect(() => {
        if (stage === 'show-qr' && qrCodeRef.current) {
            const dataString = exportDataToString();
            if (dataString) {
                qrCodeRef.current.innerHTML = '';
                const typeNumber = 0;
                const errorCorrectionLevel = 'L';
                const qr = qrcode(typeNumber, errorCorrectionLevel);
                qr.addData(dataString);
                qr.make();
                const imgTag = qr.createImgTag(4, 4);
                qrCodeRef.current.innerHTML = imgTag;
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


    const handleScanSuccess = useCallback(async (data) => {
        setStage('importing');
        setError(null);
        setMessage(null);

        if (!confirm("Importing data will overwrite all existing user accounts and history in this browser. Are you sure you want to continue?")) {
            setStage('main');
            return;
        }
        
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

    const renderMainView = () => React.createElement(React.Fragment, null,
        React.createElement('h2', { className: "text-2xl font-semibold mb-2 text-cyan-300" }, "Account & Data Sync"),
        React.createElement('p', { className: "text-slate-400 mb-6" },
            "Use QR codes to easily move your data between devices."
        ),
        React.createElement('p', { className: "text-xs text-amber-400/80 mb-6" },
            React.createElement('span', { className: "font-bold" }, "Important:"),
            " Your Gemini API Key is ",
            React.createElement('span', { className: "underline" }, "not"),
            " synced for security reasons. You must enter it separately on each device."
        ),
        error && React.createElement(Alert, { message: error, type: "error" }),
        React.createElement('div', { className: "space-y-4" },
            React.createElement('button', {
                onClick: () => setStage('show-qr'),
                className: "w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center gap-2"
            }, 'Show Sync QR Code (On old device)'),
            React.createElement('button', {
                onClick: () => setStage('scan-qr'),
                className: "w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300 flex items-center justify-center gap-2"
            }, 'Scan QR Code (On new device)')
        )
    );

    const renderShowQrView = () => React.createElement(React.Fragment, null,
        React.createElement('button', {
            onClick: () => setStage('main'),
            className: "text-sm text-cyan-400 hover:text-cyan-300 mb-4 flex items-center gap-2"
        },
        React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-4 w-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M10 19l-7-7m0 0l7-7m-7 7h18" })),
            "Back"
        ),
        React.createElement('h2', { className: "text-2xl font-semibold mb-2 text-cyan-300" }, "Your Sync Code"),
        React.createElement('p', { className: "text-slate-400 mb-4" }, "Scan this QR code with your other device to transfer your account data."),
        React.createElement('div', { ref: qrCodeRef, className: "bg-white p-2 sm:p-4 rounded-lg flex justify-center items-center max-w-xs mx-auto" })
    );
    
    const renderImportingView = () => React.createElement(React.Fragment, null,
        React.createElement('h2', { className: "text-2xl font-semibold mb-2 text-cyan-300" }, "Importing Data..."),
        React.createElement('div', { className: "flex flex-col items-center gap-4 my-8" },
            React.createElement(Spinner, null),
            message ? React.createElement(Alert, { message: message, type: "info" })
                    : React.createElement('p', null, "Applying changes, please wait.")
        )
    );

    const renderContent = () => {
        switch (stage) {
            case 'show-qr':
                return renderShowQrView();
            case 'scan-qr':
                return null;
            case 'importing':
                return renderImportingView();
            case 'main':
            default:
                return renderMainView();
        }
    }

    return React.createElement(React.Fragment, null,
        stage === 'scan-qr' && React.createElement(QrScanner, { onScanSuccess: handleScanSuccess, onCancel: () => setStage('main') }),
        React.createElement('div', { 
            className: `fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4 ${stage === 'scan-qr' ? 'hidden' : ''}`, 
            onClick: onClose 
        },
            React.createElement('div', {
                className: "bg-slate-800 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center relative",
                onClick: (e) => e.stopPropagation()
            },
            React.createElement('button', {
                onClick: onClose,
                className: "absolute top-2 right-2 text-slate-500 hover:text-white transition-colors",
                'aria-label': "Close",
                disabled: stage === 'importing'
            },
            React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2" },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" })
            )),
            renderContent()
            )
        )
    );
};

export default DataSyncModal;