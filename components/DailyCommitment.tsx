import React, { useState } from 'react';
import { StreakData } from '../types';

interface DailyCommitmentProps {
    streakData: StreakData;
    onSetCommitment: (text: string) => void;
    onCompleteCommitment: () => void;
}

const DailyCommitment: React.FC<DailyCommitmentProps> = ({ streakData, onSetCommitment, onCompleteCommitment }) => {
    const [commitmentText, setCommitmentText] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const handleSetClick = () => {
        if (commitmentText.trim()) {
            onSetCommitment(commitmentText.trim());
            setCommitmentText('');
            setIsEditing(false);
        }
    };
    
    const commitmentForToday = streakData.commitment;
    const { currentStreak } = streakData;

    return (
        <div className="w-full max-w-md mt-6 bg-slate-800/50 border border-slate-700 p-4 rounded-lg text-center animate-fade-in">
            <div className="flex items-center justify-center gap-4">
                <div className="text-4xl">🔥</div>
                <div>
                    <p className="text-2xl font-bold text-amber-400">{currentStreak}-Day Streak</p>
                    <p className="text-slate-400 text-sm">Keep it going by completing a daily goal!</p>
                </div>
            </div>
            <div className="mt-4 border-t border-slate-700 pt-4">
                {commitmentForToday ? (
                    <div className="flex items-center justify-between">
                        <label 
                            htmlFor="daily-commitment-checkbox" 
                            className={`flex items-center gap-3 cursor-pointer ${commitmentForToday.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}
                        >
                            <input
                                id="daily-commitment-checkbox"
                                type="checkbox"
                                checked={commitmentForToday.completed}
                                onChange={onCompleteCommitment}
                                disabled={commitmentForToday.completed}
                                className="h-6 w-6 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500 disabled:opacity-70"
                            />
                            <span className="flex-1 text-left">{commitmentForToday.text}</span>
                        </label>
                        {commitmentForToday.completed && (
                            <span className="text-green-400 font-bold text-sm">DONE!</span>
                        )}
                    </div>
                ) : isEditing ? (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={commitmentText}
                            onChange={(e) => setCommitmentText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSetClick()}
                            placeholder="e.g., Meditate for 10 minutes"
                            className="flex-grow bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                            autoFocus
                        />
                        <button onClick={handleSetClick} className="bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400">Set</button>
                        <button onClick={() => setIsEditing(false)} className="bg-slate-700 text-white py-2 px-4 rounded-lg hover:bg-slate-600">Cancel</button>
                    </div>
                ) : (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="w-full bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 font-semibold py-2 px-4 rounded-lg hover:bg-cyan-600/70 transition-colors"
                    >
                        Set Today's Commitment
                    </button>
                )}
            </div>
        </div>
    );
};

export default DailyCommitment;
