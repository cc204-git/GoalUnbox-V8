import React, { useState, useMemo } from 'react';
import { PlannedGoal, TodaysPlan as TodaysPlanType } from '../types';
import GoalSetter, { GoalPayload } from './GoalSetter';
import { formatDuration, getISODateString } from '../utils/timeUtils';
import { savePlan, loadPlan } from '../services/planService';

interface TodaysPlanProps {
    initialPlan: TodaysPlanType;
    onSavePlan: (plan: TodaysPlanType) => void;
    onStartGoal: (goal: PlannedGoal) => void;
    currentUser: string | null;
    onShowHistory: () => void;
}

const TodaysPlan: React.FC<TodaysPlanProps> = ({ initialPlan, onSavePlan, onStartGoal, currentUser, onShowHistory }) => {
    const [plan, setPlan] = useState(initialPlan);
    const [showForm, setShowForm] = useState(false);
    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

    // State for scheduling tomorrow
    const [isSchedulingTomorrow, setIsSchedulingTomorrow] = useState(false);
    const [tomorrowsPlan, setTomorrowsPlan] = useState<TodaysPlanType | null>(null);
    const [showTomorrowForm, setShowTomorrowForm] = useState(false);

    const handleToggleExpand = (goalId: string) => {
        setExpandedGoalId(prevId => (prevId === goalId ? null : goalId));
    };

    const handleAddGoal = (payload: GoalPayload) => {
        const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newGoal: PlannedGoal = {
            id: Date.now().toString(),
            goal: payload.goal,
            subject: payload.subject,
            timeLimitInMs: totalMs > 0 ? totalMs : null,
            consequence: payload.consequence.trim() || null,
            startTime: payload.startTime,
            endTime: payload.endTime,
            status: 'pending',
        };
        const updatedPlan = { ...plan, goals: [...plan.goals, newGoal] };
        setPlan(updatedPlan);
        onSavePlan(updatedPlan);
        setShowForm(false);
    };

    // Handlers for scheduling tomorrow
    const handleStartSchedulingTomorrow = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const planForTomorrow = loadPlan(currentUser, tomorrow) || { date: getISODateString(tomorrow), goals: [] };
        setTomorrowsPlan(planForTomorrow);
        setIsSchedulingTomorrow(true);
    };

    const handleAddGoalForTomorrow = (payload: GoalPayload) => {
        const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newGoal: PlannedGoal = {
            id: Date.now().toString(),
            goal: payload.goal,
            subject: payload.subject,
            timeLimitInMs: totalMs > 0 ? totalMs : null,
            consequence: payload.consequence.trim() || null,
            startTime: payload.startTime,
            endTime: payload.endTime,
            status: 'pending',
        };
        if (tomorrowsPlan) {
            const updatedPlan = { ...tomorrowsPlan, goals: [...tomorrowsPlan.goals, newGoal] };
            setTomorrowsPlan(updatedPlan);
            savePlan(currentUser, updatedPlan);
            setShowTomorrowForm(false);
        }
    };

    const sortGoals = (goals: PlannedGoal[]) => {
        return [...goals].sort((a, b) => {
            const aHasTime = a.startTime && a.endTime;
            const bHasTime = b.startTime && b.endTime;
            if (aHasTime && !bHasTime) return -1;
            if (!aHasTime && bHasTime) return 1;
            if (aHasTime && bHasTime) return a.startTime.localeCompare(b.startTime);
            return a.id.localeCompare(b.id);
        });
    };

    const sortedGoals = useMemo(() => sortGoals(plan.goals), [plan.goals]);
    const sortedTomorrowsGoals = useMemo(() => tomorrowsPlan ? sortGoals(tomorrowsPlan.goals) : [], [tomorrowsPlan]);
    const allGoalsCompleted = useMemo(() => plan.goals.length > 0 && plan.goals.every(g => g.status !== 'pending'), [plan.goals]);

    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const renderGoal = (goal: PlannedGoal, isTomorrow: boolean = false) => {
        const isExpanded = expandedGoalId === goal.id;
        const isCompleted = goal.status === 'completed';
        const isSkipped = goal.status === 'skipped';
        const isDone = isCompleted || isSkipped;

        let statusBadge;
        if (isCompleted) {
            statusBadge = (
                 <div className="flex items-center gap-2 text-green-500 font-bold py-2 px-4 rounded-lg bg-green-900/50 border border-green-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Completed
                </div>
            );
        } else if (isSkipped) {
             statusBadge = (
                <div className="flex items-center gap-2 text-red-400 font-bold py-2 px-4 rounded-lg bg-red-900/50 border border-red-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
                    </svg>
                    Skipped
                </div>
            );
        } else if (!isTomorrow) {
            statusBadge = (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onStartGoal(goal);
                    }}
                    className="bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 transition-colors"
                >
                    Start Goal
                </button>
            );
        }

        return (
            <div key={goal.id} className={`p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4 transition-colors ${isDone ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-800 border border-slate-600'} ${isSkipped ? 'opacity-70' : ''}`}>
                <div className="flex-shrink-0 text-center sm:text-left w-36">
                    {goal.startTime && goal.endTime ? (
                        <p className={`font-mono text-lg ${isDone ? 'text-slate-500' : 'text-cyan-300'} ${isSkipped ? 'line-through' : ''}`}>{goal.startTime} - {goal.endTime}</p>
                    ) : (
                        <p className={`font-mono text-lg ${isDone ? 'text-slate-500' : 'text-slate-400'} ${isSkipped ? 'line-through' : ''}`}>Unscheduled</p>
                    )}
                    {goal.timeLimitInMs && <p className={`text-xs ${isDone ? 'text-slate-600' : 'text-slate-400'} ${isSkipped ? 'line-through' : ''}`}>({formatDuration(goal.timeLimitInMs)})</p>}
                </div>
                <div 
                    className="flex-1 text-center sm:text-left cursor-pointer"
                    onClick={() => handleToggleExpand(goal.id)}
                >
                    <p className={`font-bold text-lg ${isCompleted ? 'text-slate-500 line-through' : isSkipped ? 'text-red-400/90 line-through' : 'text-white'}`}>{goal.subject}</p>
                    <p className={`text-sm ${isDone ? 'text-slate-600' : 'text-slate-400'} ${isExpanded ? 'whitespace-pre-wrap' : ''} ${isSkipped ? 'line-through' : ''}`}>
                        {isExpanded ? goal.goal : `${goal.goal.substring(0, 100)}${goal.goal.length > 100 ? '...' : ''}`}
                    </p>
                    {goal.goal.length > 100 && (
                        <span className="text-xs text-cyan-400/80 mt-1 inline-block">
                            {isExpanded ? 'Show Less' : 'Show More'}
                        </span>
                    )}
                </div>
                <div className="flex-shrink-0">
                    {statusBadge}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full max-w-3xl">
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center animate-fade-in relative">
                 <button
                    onClick={onShowHistory}
                    className="absolute top-4 right-4 text-slate-500 hover:text-cyan-400 transition-colors p-2"
                    aria-label="View goal history"
                    title="View Goal History"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
                <h2 className="text-3xl font-bold tracking-tighter text-cyan-300">Today's Plan</h2>
                <p className="text-slate-400 mt-1 mb-6">{today}</p>
                
                <div className="space-y-4 my-6">
                    {sortedGoals.length === 0 && !showForm && (
                        <div className="text-center py-12">
                            <p className="text-slate-500">Your plan is empty. Add a goal to get started!</p>
                        </div>
                    )}
                    {sortedGoals.map(goal => renderGoal(goal))}
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

                {allGoalsCompleted && !isSchedulingTomorrow && (
                    <div className="mt-8 pt-6 border-t border-slate-700 text-center">
                        <p className="text-lg text-green-400 mb-4">Great job finishing your plan for today!</p>
                        <button onClick={handleStartSchedulingTomorrow} className="bg-sky-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-400 transition-colors">
                            Schedule for Tomorrow
                        </button>
                    </div>
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

            {isSchedulingTomorrow && tomorrowsPlan && (
                <div className="mt-8 bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center animate-fade-in">
                     <h2 className="text-3xl font-bold tracking-tighter text-cyan-300">Scheduling for Tomorrow</h2>
                     <p className="text-slate-400 mt-1 mb-6">{new Date(new Date().setDate(new Date().getDate() + 1)).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    
                    <div className="space-y-4 my-6">
                         {sortedTomorrowsGoals.length === 0 && !showTomorrowForm && (
                            <div className="text-center py-12">
                                <p className="text-slate-500">Tomorrow's plan is empty.</p>
                            </div>
                        )}
                        {sortedTomorrowsGoals.map(goal => renderGoal(goal, true))}
                    </div>

                    {!showTomorrowForm && (
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => setShowTomorrowForm(true)}
                                className="flex-1 bg-slate-700/80 border border-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                                Add Goal for Tomorrow
                            </button>
                            <button
                                onClick={() => setIsSchedulingTomorrow(false)}
                                className="flex-1 bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 transition-colors"
                            >
                                Done for Now
                            </button>
                        </div>
                    )}

                    {showTomorrowForm && (
                         <div className="mt-6 flex justify-center">
                             <GoalSetter 
                                onGoalSubmit={handleAddGoalForTomorrow} 
                                isLoading={false} 
                                submitButtonText="Add to Tomorrow's Plan"
                                onCancel={() => setShowTomorrowForm(false)}
                            />
                         </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TodaysPlan;
