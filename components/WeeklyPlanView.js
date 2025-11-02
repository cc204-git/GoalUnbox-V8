
import React, { useState, useMemo, useEffect } from 'react';
import GoalSetter from './GoalSetter.js';
import Spinner from './Spinner.js';

const WeeklyPlanView = ({
    initialPlans,
    weekStartDate,
    onBack,
    onSavePlan,
    onStartGoal,
    onNavigateWeek,
    isLoading,
    onEditGoal
}) => {
    const [plans, setPlans] = useState(initialPlans);
    const [editingDate, setEditingDate] = useState(null);
    const [expandedGoal, setExpandedGoal] = useState(null);

    useEffect(() => {
        if(initialPlans) {
            setPlans(initialPlans);
        }
    }, [initialPlans]);

    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStartDate);
            date.setDate(date.getDate() + i);
            days.push(date);
        }
        return days;
    }, [weekStartDate]);
    
    const handleAddGoal = (payload) => {
        if (!editingDate) return;

        const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newGoal = {
            id: Date.now().toString(),
            goal: payload.goal,
            subject: payload.subject,
            timeLimitInMs: totalMs > 0 ? totalMs : null,
            startTime: payload.startTime,
            endTime: payload.endTime,
            status: 'pending',
        };

        const planToUpdate = plans.find(p => p.date === editingDate);
        if (planToUpdate) {
            const updatedPlan = { ...planToUpdate, goals: [...planToUpdate.goals, newGoal] };
            onSavePlan(updatedPlan);
            setPlans(plans.map(p => p.date === editingDate ? updatedPlan : p));
        }
        setEditingDate(null);
    };
    
    const formatWeekRange = (start) => {
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const startMonth = start.toLocaleString('default', { month: 'long' });
        const endMonth = end.toLocaleString('default', { month: 'long' });
        if (startMonth === endMonth) {
            return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
        }
        return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
    };

    const header = React.createElement('div', { className: "flex items-center justify-between mb-6 px-4" },
        React.createElement('button', { onClick: onBack, className: "text-slate-400 hover:text-white transition-colors p-2 rounded-full bg-slate-800/50 hover:bg-slate-700", 'aria-label': "Back to Today's Plan" },
            React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }))),
        React.createElement('div', { className: "text-center" },
            React.createElement('h2', { className: "text-2xl sm:text-3xl font-bold text-cyan-300" }, "Weekly Plan"),
            React.createElement('p', { className: "text-slate-400 text-sm sm:text-base" }, formatWeekRange(weekStartDate))),
        React.createElement('div', { className: "flex items-center gap-2" },
            React.createElement('button', { onClick: () => onNavigateWeek('prev'), className: "p-2 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors", 'aria-label': "Previous week" }, React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }))),
            React.createElement('button', { onClick: () => onNavigateWeek('next'), className: "p-2 rounded-full bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors", 'aria-label': "Next week" }, React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }))))
    );
    
    const content = isLoading ? React.createElement('div', { className: "flex justify-center items-center p-12" }, React.createElement(Spinner, null))
    : React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4" },
        ...weekDays.map(day => {
            const dayPlan = plans.find(p => p.date === day.toISOString().split('T')[0]) || { date: day.toISOString().split('T')[0], goals: [] };
            const sortedGoals = [...dayPlan.goals].sort((a,b) => a.startTime.localeCompare(b.startTime));
            const isToday = day.toDateString() === new Date().toDateString();

            return React.createElement('div', { key: day.toISOString(), className: `glass-panel rounded-lg flex flex-col ${isToday ? 'border-cyan-500/50' : 'border-slate-700'}` },
                React.createElement('div', { className: `p-3 border-b ${isToday ? 'border-cyan-500/30' : 'border-slate-700'}` },
                    React.createElement('p', { className: `font-bold text-center ${isToday ? 'text-cyan-300' : 'text-white'}` }, day.toLocaleDateString('en-US', { weekday: 'long' })),
                    React.createElement('p', { className: "text-sm text-slate-400 text-center" }, day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))),
                React.createElement('div', { className: "p-2 space-y-2 flex-1 overflow-y-auto max-h-96" },
                    sortedGoals.length > 0 ? sortedGoals.map(goal => {
                        const isExpanded = expandedGoal?.day === dayPlan.date && expandedGoal?.goalId === goal.id;
                        
                        const handleGoalClick = () => {
                            if (!isToday && goal.status === 'pending') {
                                onEditGoal(dayPlan, goal);
                            } else {
                                setExpandedGoal(isExpanded ? null : { day: dayPlan.date, goalId: goal.id });
                            }
                        };

                        return React.createElement('div', { key: goal.id, className: "p-2 bg-slate-900/60 rounded-md border border-slate-700 cursor-pointer", onClick: handleGoalClick },
                            React.createElement('p', { className: "font-bold text-sm text-slate-200 truncate" }, goal.subject),
                            React.createElement('p', { className: "text-xs text-slate-400" }, `${goal.startTime} - ${goal.endTime}`),
                            isExpanded && React.createElement('div', { className: "mt-2 pt-2 border-t border-slate-600" },
                                React.createElement('p', { className: "text-xs text-slate-300 whitespace-pre-wrap" }, goal.goal || "No description."),
                                goal.status === 'pending' && React.createElement('div', { className: "flex gap-4 mt-2" },
                                    React.createElement('button', { 
                                        onClick: (e) => { e.stopPropagation(); onEditGoal(dayPlan, goal); },
                                        className: "text-xs text-cyan-400 hover:underline"
                                    }, "Edit"),
                                    isToday && React.createElement('button', { 
                                        onClick: (e) => { e.stopPropagation(); onStartGoal(goal); },
                                        className: "text-xs text-green-400 hover:underline"
                                    }, "Start")
                                )
                            )
                        );
                    }) : React.createElement('p', { className: "text-xs text-slate-500 text-center p-4" }, "No goals planned.")),
                React.createElement('div', { className: "p-2 mt-auto" },
                    React.createElement('button', { onClick: () => setEditingDate(dayPlan.date), className: "w-full text-sm bg-slate-700 hover:bg-slate-600 text-cyan-300 font-semibold py-2 px-2 rounded-md transition-colors" }, "+ Add Goal"))
            );
        })
    );
    
    const goalSetterModal = editingDate && React.createElement('div', { className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4", onClick: () => setEditingDate(null) },
         React.createElement('div', { onClick: e => e.stopPropagation() },
            React.createElement(GoalSetter, {
                onGoalSubmit: handleAddGoal,
                isLoading: false,
                submitButtonText: "Add to Plan",
                onCancel: () => setEditingDate(null)
            })
         )
    );

    return React.createElement('div', { className: "w-full max-w-7xl mx-auto animate-fade-in" },
        header,
        content,
        goalSetterModal
    );
};

export default WeeklyPlanView;
