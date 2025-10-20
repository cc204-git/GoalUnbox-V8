
import React, { useMemo } from 'react';
import { formatDuration } from '../utils/timeUtils.js';

const GoalHistory = ({ onBack, history }) => {

    const sortedHistory = useMemo(() => 
        [...history].sort((a, b) => b.endTime - a.endTime), 
    [history]);

    const { totalDuration, timeBySubject } = useMemo(() => {
        const subjectTimes = {};
        let totalMs = 0;

        history.forEach(item => {
            totalMs += item.duration;
            const subject = item.subject || 'Uncategorized';
            subjectTimes[subject] = (subjectTimes[subject] || 0) + item.duration;
        });
        
        const sortedSubjects = Object.entries(subjectTimes).sort(([, a], [, b]) => b - a);

        return {
            totalDuration: formatDuration(totalMs),
            timeBySubject: sortedSubjects,
        };
    }, [history]);

    const formatDateTime = (timestamp) => {
        return new Date(timestamp).toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const backButton = React.createElement(
        'button', { onClick: onBack, className: 'absolute top-4 left-4 text-slate-400 hover:text-white transition-colors', 'aria-label': 'Go back' },
        React.createElement(
            'svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2 },
            React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M11 17l-5-5m0 0l5-5m-5 5h12' })
        )
    );

    const subjectSummary = sortedHistory.length > 0 ? React.createElement(
         'div', { className: 'my-6 border-b border-t border-slate-700 py-4' },
        React.createElement('h3', { className: 'text-xl font-semibold text-slate-300 mb-3' }, 'Time by Subject'),
        React.createElement('div', { className: 'flex flex-wrap justify-center gap-x-6 gap-y-2' },
             ...timeBySubject.map(([subject, duration]) => React.createElement(
                'div', { key: subject, className: 'text-center' },
                React.createElement('p', { className: 'text-slate-400 text-sm' }, subject),
                React.createElement('p', { className: 'text-cyan-300 font-mono text-lg' }, formatDuration(duration))
            )))
     ) : null;

    const table = sortedHistory.length === 0
        ? React.createElement('p', { className: 'text-slate-400 mt-6' }, "You haven't completed any goals yet. Let's get started!")
        : React.createElement(
            'div', { className: 'overflow-x-auto' },
            React.createElement(
                'table', { className: 'w-full text-left table-auto' },
                React.createElement(
                    'thead', { className: 'border-b border-slate-600 text-sm text-slate-400 uppercase' },
                    React.createElement('tr', null,
                        React.createElement('th', { className: 'p-3' }, 'Goal'),
                        React.createElement('th', { className: 'p-3' }, 'Subject'),
                        React.createElement('th', { className: 'p-3' }, 'Started'),
                        React.createElement('th', { className: 'p-3' }, 'Completed'),
                        React.createElement('th', { className: 'p-3 text-right' }, 'Duration')
                    )
                ),
                React.createElement(
                    'tbody', { className: 'divide-y divide-slate-700' },
                    ...sortedHistory.map(item => React.createElement(
                        'tr', { key: item.id, className: 'hover:bg-slate-800/40' },
                        React.createElement('td', { className: 'p-3 font-medium' }, item.goalSummary),
                        React.createElement('td', { className: 'p-3 text-slate-300' }, item.subject),
                        React.createElement('td', { className: 'p-3 text-slate-400' }, formatDateTime(item.startTime)),
                        React.createElement('td', { className: 'p-3 text-slate-400' }, formatDateTime(item.endTime)),
                        React.createElement('td', { className: 'p-3 text-right text-cyan-300 font-mono' }, formatDuration(item.duration))
                    ))
                ),
                React.createElement(
                    'tfoot', { className: 'border-t-2 border-slate-500 font-bold' },
                    React.createElement('tr', null,
                        React.createElement('td', { colSpan: 4, className: 'p-3 text-right text-slate-300' }, 'Total Focused Time'),
                        React.createElement('td', { className: 'p-3 text-right text-cyan-300 font-mono text-lg' }, totalDuration)
                    )
                )
            )
        );

    return React.createElement(
        'div', { className: 'bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-4xl text-center animate-fade-in relative' },
        backButton,
        React.createElement('h2', { className: 'text-3xl font-semibold mb-2 text-cyan-300' }, 'Goal History'),
        subjectSummary,
        table
    );
};

export default GoalHistory;