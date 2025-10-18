
import React, { useState, useCallback } from 'react';
import Spinner from './Spinner';

interface TimeLimit {
    hours: number;
    minutes: number;
}
export interface GoalPayload {
    goal: string;
    timeLimit: TimeLimit | null;
    consequence: string | null;
    mustLeaveTime: TimeLimit | null;
}

interface GoalSetterProps {
  onGoalSubmit: (payload: GoalPayload) => void;
  isLoading: boolean;
}

const GoalSetter: React.FC<GoalSetterProps> = ({ onGoalSubmit, isLoading }) => {
  const [goal, setGoal] = useState('');
  const [isTimeLimitEnabled, setIsTimeLimitEnabled] = useState(false);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [consequence, setConsequence] = useState('');
  const [isMustLeaveModeEnabled, setIsMustLeaveModeEnabled] = useState(false);
  const [mustLeaveHours, setMustLeaveHours] = useState('');
  const [mustLeaveMinutes, setMustLeaveMinutes] = useState('');


  const handleSubmit = useCallback(() => {
    if (goal.trim()) {
      const payload: GoalPayload = {
            goal: goal.trim(),
            timeLimit: isTimeLimitEnabled ? { hours: Number(hours) || 0, minutes: Number(minutes) || 0 } : null,
            consequence: isTimeLimitEnabled ? consequence.trim() : null,
            mustLeaveTime: isMustLeaveModeEnabled ? { hours: Number(mustLeaveHours) || 0, minutes: Number(mustLeaveMinutes) || 0 } : null,
        };
      onGoalSubmit(payload);
    }
  }, [goal, onGoalSubmit, isTimeLimitEnabled, hours, minutes, consequence, isMustLeaveModeEnabled, mustLeaveHours, mustLeaveMinutes]);

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-lg text-center animate-fade-in">
      <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Step 2: Define Your Goal</h2>
      <p className="text-slate-400 mb-6">Be specific! The AI will use this description to verify your proof of completion.</p>
      
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="e.g., 'Finish writing chapter 1 of my book, ensuring it is at least 3,000 words.'"
        className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition mb-6"
        disabled={isLoading}
      />

      <div className="border-t border-slate-700 pt-6 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
            <input 
                type="checkbox"
                checked={isTimeLimitEnabled}
                onChange={(e) => setIsTimeLimitEnabled(e.target.checked)}
                className="h-5 w-5 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-slate-300 font-semibold">Add a Time Limit & Consequence (Optional)</span>
        </label>

        {isTimeLimitEnabled && (
            <div className="mt-4 space-y-4 text-left animate-fade-in">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Time Limit</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            placeholder="Hours"
                            min="0"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                        />
                         <input 
                            type="number"
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            placeholder="Minutes"
                            min="0"
                            max="59"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                        />
                    </div>
                </div>
                 <div>
                    <label htmlFor="consequence" className="block text-sm font-medium text-slate-400 mb-1">Consequence</label>
                    <textarea
                        id="consequence"
                        value={consequence}
                        onChange={(e) => setConsequence(e.target.value)}
                        placeholder="e.g., 'I must also clean the garage.'"
                        className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                        disabled={isLoading}
                    />
                 </div>
            </div>
        )}
      </div>

       <div className="border-t border-slate-700 pt-6 mb-6">
        <label className="flex items-center gap-3 cursor-pointer">
            <input 
                type="checkbox"
                checked={isMustLeaveModeEnabled}
                onChange={(e) => setIsMustLeaveModeEnabled(e.target.checked)}
                className="h-5 w-5 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-slate-300 font-semibold">Add Must Leave Time (Optional)</span>
        </label>
        <p className="text-xs text-slate-500 text-left mt-1 ml-8">Set a hard deadline to get your code back, even if the goal isn't complete.</p>

        {isMustLeaveModeEnabled && (
            <div className="mt-4 space-y-4 text-left animate-fade-in">
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Reveal Code After</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number"
                            value={mustLeaveHours}
                            onChange={(e) => setMustLeaveHours(e.target.value)}
                            placeholder="Hours"
                            min="0"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                        />
                         <input 
                            type="number"
                            value={mustLeaveMinutes}
                            onChange={(e) => setMustLeaveMinutes(e.target.value)}
                            placeholder="Minutes"
                            min="0"
                            max="59"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                        />
                    </div>
                </div>
            </div>
        )}
      </div>


      <button
        onClick={handleSubmit}
        disabled={!goal.trim() || isLoading}
        className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
      >
        {isLoading ? <Spinner /> : 'Set My Goal'}
      </button>
    </div>
  );
};

export default GoalSetter;
