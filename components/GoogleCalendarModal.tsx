import React from 'react';
import { GoogleCalendarEvent } from '../types';
import Spinner from './Spinner';

interface GoogleCalendarModalProps {
    events: GoogleCalendarEvent[];
    isLoading: boolean;
    onClose: () => void;
    onAddGoal: (event: GoogleCalendarEvent) => void;
}

const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({ events, isLoading, onClose, onAddGoal }) => {
    const formatEventTime = (event: GoogleCalendarEvent) => {
        if (event.start.dateTime) {
            const start = new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            const end = event.end.dateTime ? new Date(event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
            return `${start} - ${end}`;
        }
        return 'All day';
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4"
            onClick={onClose}
        >
            <div 
                className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-2xl w-full max-w-lg text-center relative max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                <h2 className="text-2xl font-semibold mb-4 text-cyan-300">Today's Calendar Events</h2>
                
                <div className="flex-1 overflow-y-auto pr-2">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <Spinner />
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-slate-500">
                            <p>No events found for today.</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {events.map(event => (
                                <li key={event.id} className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-left flex items-center justify-between gap-4">
                                    <div>
                                        <p className="font-mono text-sm text-cyan-300">{formatEventTime(event)}</p>
                                        <p className="font-bold text-white mt-1">{event.summary}</p>
                                    </div>
                                    <button
                                        onClick={() => onAddGoal(event)}
                                        className="bg-cyan-500 text-slate-900 font-bold py-2 px-3 rounded-lg hover:bg-cyan-400 text-sm flex-shrink-0"
                                    >
                                        Add as Goal
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GoogleCalendarModal;
