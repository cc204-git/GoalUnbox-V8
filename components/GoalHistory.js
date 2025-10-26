
import React, { useMemo, useState } from 'react';
import { formatDuration } from '../utils/timeUtils.js';
import { generateHistoryInsights } from '../services/geminiService.js';
import Spinner from './Spinner.js';
import Alert from './Alert.js';

const GoalHistory = ({ onBack, history, onDeleteHistoryItem }) => {

    const sortedHistory = useMemo(() => 
        [...history].sort((a, b) => b.endTime - a.endTime), 
    [history]);

    const [insights, setInsights] = useState(null);
    const [isInsightsLoading, setIsInsightsLoading] = useState(false);
    const [insightsError, setInsightsError] = useState(null);

    const { totalDuration, timeBySubject } = useMemo(() => {
        const subjectTimesFocused = {};
        let totalFocusedMs = 0;
        
        history.forEach(item => {
            if (item.completionReason !== 'skipped') {
                 totalFocusedMs += item.duration;
                 const subject = item.subject || 'Uncategorized';
                 subjectTimesFocused[subject] = (subjectTimesFocused[subject] || 0) + item.duration;
            }
        });
        
        const sortedSubjects = Object.entries(subjectTimesFocused).sort(([, a], [, b]) => b - a);

        return {
            totalDuration: formatDuration(totalFocusedMs),
            timeBySubject: sortedSubjects,
        };
    }, [history]);

    const handleGenerateReport = async () => {
        setIsInsightsLoading(true);
        setInsights(null);
        setInsightsError(null);
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weeklyHistory = history.filter(goal => goal.endTime > oneWeekAgo.getTime());

            if (weeklyHistory.length < 3) {
                setInsightsError("You need at least 3 completed goals in the last 7 days to generate a report.");
                setIsInsightsLoading(false);
                return;
            }

            const result = await generateHistoryInsights(weeklyHistory);
            setInsights(result);
        } catch (err) {
            setInsightsError(err.message);
        } finally {
            setIsInsightsLoading(false);
        }
    };

    const handleDelete = (item) => {
        if (item.firestoreId && window.confirm(`Are you sure you want to delete the goal: "${item.goalSummary}"? This action cannot be undone.`)) {
            onDeleteHistoryItem(item.firestoreId);
        }
    };

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
    
    const insightsSection = React.createElement(
        'div', { className: 'my-6' },
        insightsError && React.createElement(Alert, { message: insightsError, type: 'error' }),
        insights ? React.createElement(
            'div', { className: 'p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-left relative animate-fade-in' },
            React.createElement('h3', { className: 'text-xl font-semibold text-cyan-300 mb-2' }, 'Weekly Productivity Report'),
            React.createElement(
                'button', { onClick: () => setInsights(null), className: 'absolute top-2 right-2 text-slate-500 hover:text-white p-1', 'aria-label': 'Close insights' },
                React.createElement(
                    'svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-6 w-6', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2 },
                    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', d: 'M6 18L18 6M6 6l12 12' })
                )
            ),
            React.createElement('div', { className: 'text-slate-300 whitespace-pre-wrap font-sans text-sm', dangerouslySetInnerHTML: { __html: insights.replace(/\n/g, '<br />') }})
        ) : React.createElement(
            'button', {
                onClick: handleGenerateReport,
                disabled: isInsightsLoading || history.length < 3,
                className: 'w-full sm:w-auto bg-slate-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300 flex items-center justify-center gap-2 mx-auto disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed'
            },
            isInsightsLoading ? React.createElement(React.Fragment, null, React.createElement(Spinner, null), ' Analyzing...') : 'Generate Weekly Report'
        ),
        history.filter(g => { const d = new Date(); d.setDate(d.getDate() - 7); return g.endTime > d.getTime() }).length < 3 && !insights && React.createElement('p', { className: 'text-xs text-slate-500 mt-2' }, 'Complete at least 3 goals in the last week to unlock the Weekly Report.')
    );


    const subjectSummary = sortedHistory.length > 0 && timeBySubject.length > 0 ? React.createElement(
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
                        React.createElement('th', { className: 'p-3 text-right' }, 'Duration'),
                        React.createElement('th', { className: 'p-3 text-right' }, 'Actions')
                    )
                ),
                React.createElement(
                    'tbody', { className: 'divide-y divide-slate-700' },
                    ...sortedHistory.map(item => React.createElement(
                        'tr', { key: item.id, className: `hover:bg-slate-800/40 ${item.completionReason === 'skipped' ? 'opacity-70' : ''}` },
                        React.createElement('td', { className: 'p-3 font-medium' },
                             React.createElement('div', { className: 'flex items-center gap-2' },
                                item.completionReason === 'skipped' && React.createElement(
                                    'svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5 text-red-400 flex-shrink-0', viewBox: '0 0 20 20', fill: 'currentColor'},
                                    React.createElement('title', null, 'Skipped'),
                                    React.createElement('path', { d: "M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" })
                                ),
                                React.createElement('span', { className: item.completionReason === 'skipped' ? 'text-red-400' : '' }, item.goalSummary)
                            )
                        ),
                        React.createElement('td', { className: 'p-3 text-slate-300' }, item.subject),
                        React.createElement('td', { className: 'p-3 text-slate-400' }, formatDateTime(item.startTime)),
                        React.createElement('td', { className: 'p-3 text-slate-400' }, formatDateTime(item.endTime)),
                        React.createElement('td', { className: 'p-3 text-right text-cyan-300 font-mono' }, formatDuration(item.duration)),
                        React.createElement('td', { className: 'p-3 text-right' }, 
                            React.createElement('button', {
                                onClick: () => handleDelete(item),
                                className: 'text-slate-500 hover:text-red-400 p-1 rounded-full transition-colors',
                                'aria-label': `Delete goal "${item.goalSummary}"`,
                                title: 'Delete'
                            }, React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' },
                                React.createElement('path', { fillRule: 'evenodd', d: 'M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z', clipRule: 'evenodd' }))
                            ))
                    ))
                ),
                totalDuration !== '0s' && React.createElement(
                    'tfoot', { className: 'border-t-2 border-slate-500 font-bold' },
                    React.createElement('tr', null,
                        React.createElement('td', { colSpan: 4, className: 'p-3 text-right text-slate-300' }, 'Total Focused Time'),
                        React.createElement('td', { className: 'p-3 text-right text-cyan-300 font-mono text-lg' }, totalDuration),
                        React.createElement('td', null)
                    )
                )
            )
        );

    return React.createElement(
        'div', { className: 'bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-4xl text-center animate-fade-in relative' },
        backButton,
        React.createElement('h2', { className: 'text-3xl font-semibold mb-2 text-cyan-300' }, 'Goal History'),
        insightsSection,
        subjectSummary,
        table
    );
};

export default GoalHistory;
