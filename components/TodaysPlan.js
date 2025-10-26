import React, { useState, useMemo, useRef } from 'react';
import GoalSetter from './GoalSetter.js';
import { formatDuration, getISODateString } from '../utils/timeUtils.js';
import { savePlan, loadPlan } from '../services/planService.js';
import { extractScheduleFromImage } from '../services/geminiService.js';
import Spinner from './Spinner.js';
import Alert from './Alert.js';
import { fileToBase64 } from '../utils/fileUtils.js';


const TodaysPlan = ({ initialPlan, onSavePlan, onStartGoal, currentUser, onShowHistory }) => {
    const [plan, setPlan] = useState(initialPlan);
    const [showForm, setShowForm] = useState(false);
    const [expandedGoalId, setExpandedGoalId] = useState(null);
    const [isSchedulingTomorrow, setIsSchedulingTomorrow] = useState(false);
    const [tomorrowsPlan, setTomorrowsPlan] = useState(null);
    const [showTomorrowForm, setShowTomorrowForm] = useState(false);

    const fileInputRef = useRef(null);
    const [isLoadingImport, setIsLoadingImport] = useState(false);
    const [importError, setImportError] = useState(null);
    const [importedGoals, setImportedGoals] = useState([]);
    const [editingImportedGoal, setEditingImportedGoal] = useState(null);

    const handleToggleExpand = (goalId) => {
        setExpandedGoalId(prevId => (prevId === goalId ? null : goalId));
    };

    const handleAddGoal = (payload) => {
        const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newGoal = {
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

    const handleStartSchedulingTomorrow = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const planForTomorrow = loadPlan(currentUser, tomorrow) || { date: getISODateString(tomorrow), goals: [] };
        setTomorrowsPlan(planForTomorrow);
        setIsSchedulingTomorrow(true);
    };

    const handleAddGoalForTomorrow = (payload) => {
        const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newGoal = {
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
    
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoadingImport(true);
        setImportError(null);
        setImportedGoals([]);

        try {
            const base64 = await fileToBase64(file);
            const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const dayOfWeek = dayNames[new Date().getDay()];
            
            const events = await extractScheduleFromImage(base64, file.type, dayOfWeek);
            if (events.length === 0) {
                setImportError(`No events found for ${dayOfWeek} in the provided image.`);
            } else {
                setImportedGoals(events);
            }
        } catch (err) {
            setImportError(err.message);
        } finally {
            setIsLoadingImport(false);
            e.target.value = '';
        }
    };
    
    const handleEditImportedGoal = (goal) => {
        setEditingImportedGoal(goal);
    };

    const handleConfirmImportedGoal = (payload) => {
        handleAddGoal(payload);
        setImportedGoals(prev => prev.filter(g => g.startTime !== editingImportedGoal?.startTime || g.subject !== editingImportedGoal?.subject));
        setEditingImportedGoal(null);
    };

    const handleCancelImport = () => {
        setImportedGoals([]);
        setEditingImportedGoal(null);
        setImportError(null);
    };

    const sortGoals = (goals) => {
        return [...goals].sort((a, b) => {
            if (a.id.startsWith('PENALTY-')) return -1;
            if (b.id.startsWith('PENALTY-')) return 1;
            const aHasTime = a.startTime && a.endTime;
            const bHasTime = b.startTime && b.endTime;
            if (aHasTime && !bHasTime) return -1;
            if (!aHasTime && bHasTime) return 1;
            if (aHasTime && bHasTime) return a.startTime.localeCompare(b.startTime);
            return a.id.localeCompare(b.id);
        });
    };
    
    const penaltyGoal = useMemo(() => {
        const pGoal = plan.goals.find(g => g.id.startsWith('PENALTY-'));
        return pGoal && pGoal.status === 'pending' ? pGoal : null;
    }, [plan.goals]);

    const sortedGoals = useMemo(() => sortGoals(plan.goals), [plan.goals]);
    const sortedTomorrowsGoals = useMemo(() => tomorrowsPlan ? sortGoals(tomorrowsPlan.goals) : [], [tomorrowsPlan]);
    const allGoalsCompleted = useMemo(() => plan.goals.length > 0 && plan.goals.every(g => g.status !== 'pending'), [plan.goals]);
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const renderGoal = (goal, isTomorrow = false, isLocked = false) => {
        const isExpanded = expandedGoalId === goal.id;
        const isCompleted = goal.status === 'completed';
        const isSkipped = goal.status === 'skipped';
        const isDone = isCompleted || isSkipped;

        let statusBadge;
        if (isCompleted) {
            statusBadge = React.createElement('div', { className: 'flex items-center gap-2 text-green-500 font-bold py-2 px-4 rounded-lg bg-green-900/50 border border-green-500/30' },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' }, React.createElement('path', { fillRule: 'evenodd', d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z', clipRule: 'evenodd' })),
                'Completed'
            );
        } else if (isSkipped) {
            statusBadge = React.createElement('div', { className: 'flex items-center gap-2 text-red-400 font-bold py-2 px-4 rounded-lg bg-red-900/50 border border-red-500/30' },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' }, React.createElement('path', { d: 'M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z' })),
                'Skipped'
            );
        } else if (!isTomorrow) {
            statusBadge = React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); onStartGoal(goal); },
                disabled: isLocked,
                className: 'bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400 transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed',
                title: isLocked ? "You must complete the penalty goal first." : "Start this goal"
            }, 'Start Goal');
        }


        return React.createElement('div', { key: goal.id, className: `p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4 transition-colors ${isDone ? 'bg-slate-900/50 border border-slate-700' : 'bg-slate-800 border border-slate-600'} ${isSkipped ? 'opacity-70' : ''}` },
            React.createElement('div', { className: 'flex-shrink-0 text-center sm:text-left w-36' },
                goal.startTime && goal.endTime ?
                    React.createElement('p', { className: `font-mono text-lg ${isDone ? 'text-slate-500' : 'text-cyan-300'} ${isSkipped ? 'line-through' : ''}` }, `${goal.startTime} - ${goal.endTime}`) :
                    React.createElement('p', { className: `font-mono text-lg ${isDone ? 'text-slate-500' : 'text-slate-400'} ${isSkipped ? 'line-through' : ''}` }, 'Unscheduled'),
                goal.timeLimitInMs && React.createElement('p', { className: `text-xs ${isDone ? 'text-slate-600' : 'text-slate-400'} ${isSkipped ? 'line-through' : ''}` }, `(${formatDuration(goal.timeLimitInMs)})`)
            ),
            React.createElement('div', {
                className: 'flex-1 text-center sm:text-left cursor-pointer',
                onClick: () => handleToggleExpand(goal.id)
            },
                React.createElement('p', { className: `font-bold text-lg ${isCompleted ? 'text-slate-500 line-through' : isSkipped ? 'text-red-400/90 line-through' : 'text-white'}` }, goal.subject),
                React.createElement('p', { className: `text-sm ${isDone ? 'text-slate-600' : 'text-slate-400'} ${isExpanded ? 'whitespace-pre-wrap' : ''} ${isSkipped ? 'line-through' : ''}` }, isExpanded ? goal.goal : `${goal.goal.substring(0, 100)}${goal.goal.length > 100 ? '...' : ''}`),
                goal.goal.length > 100 && React.createElement('span', { className: "text-xs text-cyan-400/80 mt-1 inline-block" }, isExpanded ? 'Show Less' : 'Show More')
            ),
            React.createElement('div', { className: 'flex-shrink-0' }, statusBadge)
        );
    };

    if (isLoadingImport) {
        return React.createElement('div', { className: "w-full max-w-3xl bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl text-center animate-fade-in" },
            React.createElement('div', { className: 'flex flex-col items-center gap-4' },
                React.createElement(Spinner, null),
                React.createElement('p', null, 'Analyzing your schedule...')
            )
        );
    }
    
    if (editingImportedGoal) {
        return React.createElement('div', { className: 'w-full max-w-3xl flex justify-center mt-6' },
            React.createElement(GoalSetter, {
                initialData: editingImportedGoal,
                onGoalSubmit: handleConfirmImportedGoal,
                isLoading: false,
                submitButtonText: "Add Imported Goal to Plan",
                onCancel: () => setEditingImportedGoal(null)
            })
        );
    }

    if (importedGoals.length > 0) {
        return React.createElement('div', { className: 'w-full max-w-3xl bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl text-center animate-fade-in' },
            React.createElement('h2', { className: 'text-2xl font-semibold mb-2 text-cyan-300' }, 'Review Imported Goals'),
            React.createElement('p', { className: 'text-slate-400 mb-6' }, 'These events were found for today. Add them to your plan.'),
            React.createElement('div', { className: 'space-y-3' },
                importedGoals.map((goal, index) => React.createElement('div', { key: index, className: 'p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-left flex items-center justify-between gap-4' },
                    React.createElement('div', null,
                        React.createElement('p', { className: 'font-mono text-sm text-cyan-300' }, `${goal.startTime} - ${goal.endTime}`),
                        React.createElement('p', { className: 'font-bold text-white mt-1' }, goal.subject)
                    ),
                    React.createElement('button', {
                        onClick: () => handleEditImportedGoal(goal),
                        className: 'bg-cyan-500 text-slate-900 font-bold py-2 px-3 rounded-lg hover:bg-cyan-400 text-sm flex-shrink-0'
                    }, 'Edit & Add')
                ))
            ),
            React.createElement('button', { onClick: handleCancelImport, className: 'mt-6 text-slate-400 hover:text-white text-sm' }, 'Cancel Import')
        );
    }

    const tomorrowSchedulingUI = isSchedulingTomorrow && tomorrowsPlan && React.createElement('div', { className: 'mt-8 bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center animate-fade-in' },
        React.createElement('h2', { className: 'text-3xl font-bold tracking-tighter text-cyan-300' }, "Scheduling for Tomorrow"),
        React.createElement('p', { className: 'text-slate-400 mt-1 mb-6' }, new Date(new Date().setDate(new Date().getDate() + 1)).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })),
        React.createElement('div', { className: 'space-y-4 my-6' },
            sortedTomorrowsGoals.length === 0 && !showTomorrowForm && React.createElement('div', { className: 'text-center py-12' }, React.createElement('p', { className: 'text-slate-500' }, "Tomorrow's plan is empty.")),
            sortedTomorrowsGoals.map(goal => renderGoal(goal, true))
        ),
        !showTomorrowForm && React.createElement('div', { className: 'flex flex-col sm:flex-row gap-4' },
            React.createElement('button', {
                onClick: () => setShowTomorrowForm(true),
                className: 'flex-1 bg-slate-700/80 border border-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2'
            },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' }, React.createElement('path', { fillRule: 'evenodd', d: 'M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z', clipRule: 'evenodd' })),
                'Add Goal for Tomorrow'
            ),
            React.createElement('button', {
                onClick: () => setIsSchedulingTomorrow(false),
                className: 'flex-1 bg-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-500 transition-colors'
            }, 'Done for Now')
        ),
        showTomorrowForm && React.createElement('div', { className: 'mt-6 flex justify-center' },
            React.createElement(GoalSetter, {
                onGoalSubmit: handleAddGoalForTomorrow,
                isLoading: false,
                submitButtonText: "Add to Tomorrow's Plan",
                onCancel: () => setShowTomorrowForm(false)
            })
        )
    );
    
    const historyButton = React.createElement('button', {
        onClick: onShowHistory,
        className: "absolute top-4 right-4 text-slate-500 hover:text-cyan-400 transition-colors p-2",
        'aria-label': "View goal history",
        title: "View Goal History"
    },
    React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 },
        React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }))
    );

    return React.createElement('div', { className: 'w-full max-w-3xl' },
        React.createElement('div', { className: 'bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center animate-fade-in relative' },
            historyButton,
            React.createElement('h2', { className: 'text-3xl font-bold tracking-tighter text-cyan-300' }, "Today's Plan"),
            React.createElement('p', { className: 'text-slate-400 mt-1 mb-6' }, today),
            penaltyGoal && React.createElement('div', { className: 'my-4' }, 
                React.createElement(Alert, {
                    type: 'error',
                    message: "INCOMPLETE DAY PENALTY: You must complete the first goal before starting any others for today."
                })
            ),
            React.createElement('div', { className: 'space-y-4 my-6' },
                sortedGoals.length === 0 && !showForm && React.createElement('div', { className: 'text-center py-12' }, React.createElement('p', { className: 'text-slate-500' }, 'Your plan is empty. Add a goal to get started!')),
                sortedGoals.map(goal => renderGoal(goal, false, !!penaltyGoal && goal.id !== penaltyGoal.id))
            ),
            !showForm && React.createElement('div', { className: 'flex flex-col sm:flex-row gap-4' },
                React.createElement('input', { type: 'file', ref: fileInputRef, onChange: handleFileChange, accept: 'image/*', className: 'hidden' }),
                React.createElement('button', {
                    onClick: () => setShowForm(true),
                    className: 'flex-1 bg-slate-700/80 border border-slate-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-700 transition-colors flex items-center justify-center gap-2'
                },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' }, React.createElement('path', { fillRule: 'evenodd', d: 'M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z', clipRule: 'evenodd' })),
                    'Add New Goal'
                ),
                React.createElement('button', {
                    onClick: handleImportClick,
                    className: 'flex-1 bg-sky-600/50 border border-sky-500/50 text-sky-300 font-semibold py-3 px-4 rounded-lg hover:bg-sky-600/70 transition-colors flex items-center justify-center gap-2'
                },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' }, React.createElement('path', { fillRule: 'evenodd', d: 'M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z', clipRule: 'evenodd' })),
                    'Import Schedule'
                )
            ),
            importError && React.createElement('div', { className: 'mt-4' }, React.createElement(Alert, { message: importError, type: 'error' })),
            allGoalsCompleted && !isSchedulingTomorrow && React.createElement('div', { className: 'mt-8 pt-6 border-t border-slate-700 text-center' },
                React.createElement('p', { className: 'text-lg text-green-400 mb-4' }, 'Great job finishing your plan for today!'),
                React.createElement('button', { onClick: handleStartSchedulingTomorrow, className: 'bg-sky-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-sky-400 transition-colors' }, 'Schedule for Tomorrow')
            )
        ),
        showForm && React.createElement('div', { className: 'mt-6 flex justify-center' },
            React.createElement(GoalSetter, {
                onGoalSubmit: handleAddGoal,
                isLoading: false,
                submitButtonText: 'Add to Plan',
                onCancel: () => setShowForm(false)
            })
        ),
        tomorrowSchedulingUI
    );
};

export default TodaysPlan;