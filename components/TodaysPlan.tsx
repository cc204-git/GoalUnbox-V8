import React, { useState, useMemo } from 'react';
import { PlannedGoal, TodaysPlan as TodaysPlanType } from '../types';
import GoalSetter, { GoalPayload } from './GoalSetter';
import { formatDuration } from '../utils/timeUtils';

interface TodaysPlanProps {
    initialPlan: TodaysPlanType;
    onSavePlan: (plan: TodaysPlanType) => void;
    onStartGoal: (goal: PlannedGoal) => void;
}

const TodaysPlan: React.FC<TodaysPlanProps> = ({ initialPlan, onSavePlan, onStartGoal }) => {
    const [plan, setPlan] = useState(initialPlan);
    const [showForm, setShowForm] = useState(false);

    const handleAddGoal = (payload: GoalPayload) => {
        const newGoal: PlannedGoal = {
            id: Date.now().toString(),
            goal: payload.goal,
            subject: payload.subject,
            timeLimitInMs: (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000,
            consequence: payload.consequence,
            startTime: payload.startTime,
            endTime: payload.endTime,
            completed: false,
        };
        const updatedPlan = { ...plan, goals: [...plan.goals, newGoal] };
        setPlan(updatedPlan);
        onSavePlan(updatedPlan);
        setShowForm(false);
    };

    const sortedGoals = useMemo(() => {
        return [...plan.goals].sort((a, b) => {
            return a.startTime.localeCompare(b.startTime);
        });
    }, [plan.goals]);

    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="w-full max-w-3xl">
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center animate-fade-in">
                <h2 className="text-3xl font-bold tracking-tighter text-cyan-300">Today's Plan</h2>
                <p className="text-slate-400 mt-1 mb-6">{today}</p>
                
                <div className="space-y-4 my-6">
                    {sortedGoals.length === 0 && !showForm && (
                        <div className="text-center py-12">
                            <p className="text-slate-500">Your plan is empty. Add a goal to get started!</p>
                        </div>
                    )}
                    {sortedGoals.map(goal => (
                        <div key={goal.id} className={`p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4 transition-colors ${goal.completed ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-800 border border-slate-600'}`}>
                            <div className="flex-shrink-0 text-center sm:text-left">
                                <p className={`font-mono text-lg ${goal.completed ? 'text-slate-500' : 'text-cyan-300'}`}>{goal.startTime} - {goal.endTime}</p>
                                {goal.timeLimitInMs && <p className={`text-xs ${goal.completed ? 'text-slate-600' : 'text-slate-400'}`}>({formatDuration(goal.timeLimitInMs)})</p>}
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <p className={`font-bold text-lg ${goal.completed ? 'text-slate-500 line-through' : 'text-white'}`}>{goal.subject}</p>
                                <p className={`text-sm ${goal.completed ? 'text-slate-600' : 'text-slate-400'}`}>{goal.goal.substring(0, 100)}{goal.goal.length > 100 ? '...' : ''}</p>
                            </div>
                            <div className="flex-shrink-0">
                                {goal.completed ? (
                                     <div className="flex items-center gap-2 text-green-500 font-bold py-2 px-4 rounded-lg bg-green-900/50 border border-green-500/30">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        Completed
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => onStartGoal(goal)}
                                        className="bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 transition-colors"
                                    >
                                        Start Goal
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {!showForm && (
                     <button
                        onClick={() => setShowForm(true)}
                        className="w-full bg-slate-700/80 border border-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Add New Goal
                    </button>
                )}
            </div>

            {showForm && (
                <div className="mt-6 flex justify-center">
                    <GoalSetter 
                        onGoalSubmit={handleAddGoal} 
                        isLoading={false} 
                        submitButtonText="Add to Plan"
                        onCancel={() => setShowForm(false)}
                    />
                </div>
            )}
        </div>
    );
};

export default TodaysPlan;