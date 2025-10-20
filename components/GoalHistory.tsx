import React, { useMemo } from 'react';
import { CompletedGoal } from '../types';
import { formatDuration } from '../utils/timeUtils';

interface GoalHistoryProps {
  onBack: () => void;
  history: CompletedGoal[];
}

const GoalHistory: React.FC<GoalHistoryProps> = ({ onBack, history }) => {
    const sortedHistory = useMemo(() => 
        [...history].sort((a: CompletedGoal, b: CompletedGoal) => b.endTime - a.endTime), 
    [history]);

    const totalDuration = useMemo(() => {
        const totalMs = history.reduce((sum, item) => sum + item.duration, 0);
        return formatDuration(totalMs);
    }, [history]);

    const formatDateTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-4xl text-center animate-fade-in relative">
            <button
                onClick={onBack}
                className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors"
                aria-label="Go back"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
            </button>
            <h2 className="text-3xl font-semibold mb-6 text-cyan-300">Goal History</h2>

            {sortedHistory.length === 0 ? (
                <p className="text-slate-400">You haven't completed any goals yet. Let's get started!</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left table-auto">
                        <thead className="border-b border-slate-600 text-sm text-slate-400 uppercase">
                            <tr>
                                <th className="p-3">Goal</th>
                                <th className="p-3">Started</th>
                                <th className="p-3">Completed</th>
                                <th className="p-3 text-right">Duration</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {sortedHistory.map(item => (
                                <tr key={item.id} className="hover:bg-slate-800/40">
                                    <td className="p-3 font-medium">{item.goalSummary}</td>
                                    <td className="p-3 text-slate-400">{formatDateTime(item.startTime)}</td>
                                    <td className="p-3 text-slate-400">{formatDateTime(item.endTime)}</td>
                                    <td className="p-3 text-right text-cyan-300 font-mono">{formatDuration(item.duration)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-500 font-bold">
                            <tr>
                                <td colSpan={3} className="p-3 text-right text-slate-300">Total Focused Time</td>
                                <td className="p-3 text-right text-cyan-300 font-mono text-lg">{totalDuration}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

export default GoalHistory;