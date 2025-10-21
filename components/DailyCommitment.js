import React, { useState } from 'react';

const DailyCommitment = ({ streakData, onSetCommitment, onCompleteCommitment }) => {
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

    const content = commitmentForToday ? (
        React.createElement('div', { className: 'flex items-center justify-between' },
            React.createElement('label', {
                htmlFor: 'daily-commitment-checkbox',
                className: `flex items-center gap-3 cursor-pointer ${commitmentForToday.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`
            },
                React.createElement('input', {
                    id: 'daily-commitment-checkbox',
                    type: 'checkbox',
                    checked: commitmentForToday.completed,
                    onChange: onCompleteCommitment,
                    disabled: commitmentForToday.completed,
                    className: 'h-6 w-6 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500 disabled:opacity-70'
                }),
                React.createElement('span', { className: 'flex-1 text-left' }, commitmentForToday.text)
            ),
            commitmentForToday.completed && React.createElement('span', { className: 'text-green-400 font-bold text-sm' }, 'DONE!')
        )
    ) : isEditing ? (
        React.createElement('div', { className: 'flex gap-2' },
            React.createElement('input', {
                type: 'text',
                value: commitmentText,
                onChange: (e) => setCommitmentText(e.target.value),
                onKeyPress: (e) => e.key === 'Enter' && handleSetClick(),
                placeholder: 'e.g., Meditate for 10 minutes',
                className: 'flex-grow bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500',
                autoFocus: true
            }),
            React.createElement('button', { onClick: handleSetClick, className: 'bg-cyan-500 text-slate-900 font-bold py-2 px-4 rounded-lg hover:bg-cyan-400' }, 'Set'),
            React.createElement('button', { onClick: () => setIsEditing(false), className: 'bg-slate-700 text-white py-2 px-4 rounded-lg hover:bg-slate-600' }, 'Cancel')
        )
    ) : (
        React.createElement('button', {
            onClick: () => setIsEditing(true),
            className: 'w-full bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 font-semibold py-2 px-4 rounded-lg hover:bg-cyan-600/70 transition-colors'
        }, "Set Today's Commitment")
    );


    return React.createElement('div', { className: 'w-full max-w-md mt-6 bg-slate-800/50 border border-slate-700 p-4 rounded-lg text-center animate-fade-in' },
        React.createElement('div', { className: 'flex items-center justify-center gap-4' },
            React.createElement('div', { className: 'text-4xl' }, '🔥'),
            React.createElement('div', null,
                React.createElement('p', { className: 'text-2xl font-bold text-amber-400' }, `${currentStreak}-Day Streak`),
                React.createElement('p', { className: 'text-slate-400 text-sm' }, 'Keep it going by completing a daily goal!')
            )
        ),
        React.createElement('div', { className: 'mt-4 border-t border-slate-700 pt-4' }, content)
    );
};

export default DailyCommitment;
