
import React, { useState, useCallback, useEffect } from 'react';
import Spinner from './Spinner';
import Alert from './Alert';

interface TimeLimit {
    hours: number;
    minutes: number;
}
export interface GoalPayload {
    goal: string;
    subject: string;
    timeLimit: TimeLimit;
    consequence: string;
    startTime: string;
    endTime: string;
}

interface GoalSetterProps {
  onGoalSubmit: (payload: GoalPayload) => void;
  isLoading: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
  initialData?: {
      subject?: string;
      startTime?: string;
      endTime?: string;
  }
}

const GoalSetter: React.FC<GoalSetterProps> = ({ onGoalSubmit, isLoading, submitButtonText = 'Set My Goal', onCancel, initialData }) => {
  const [goal, setGoal] = useState('');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [consequence, setConsequence] = useState('');
  const [subQuestions, setSubQuestions] = useState('');
  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [timeError, setTimeError] = useState<string | null>(null);

  const consequenceTemplates = [
    `I will submit my homework on separate, numbered papers.
Each paper will have the date DD/MM/YY written at the top.
My homework will include:
Exercise X: Y Questions
I will make sure that all exercises and questions are clearly highlighted on each paper.`
  ];
  const [consequenceTemplateIndex, setConsequenceTemplateIndex] = useState(0);

  const handleUseConsequenceTemplate = () => {
      const nextIndex = (consequenceTemplateIndex + 1) % consequenceTemplates.length;
      setConsequence(consequenceTemplates[consequenceTemplateIndex]);
      setConsequenceTemplateIndex(nextIndex);
  };

  useEffect(() => {
    if (initialData) {
        setSubject(initialData.subject || '');
        setStartTime(initialData.startTime || '');
        setEndTime(initialData.endTime || '');
    }
  }, [initialData]);

  useEffect(() => {
    const userMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);

    const lowerCaseGoal = goal.toLowerCase();
    const hasExemptionKeyword = lowerCaseGoal.includes('devoir') || lowerCaseGoal.includes('probleme') || lowerCaseGoal.includes('serie');

    if (hasExemptionKeyword) {
        setTimeError(null);
        return;
    }
    if (userMinutes === 0 || !goal.trim() || !subject.trim()) {
        setTimeError(null);
        return;
    }
    const questionRegex = /(\d+)\s+questions?/gi;
    const matches = [...goal.matchAll(questionRegex)];
    let totalQuestions = 0;
    if (matches.length > 0) {
        totalQuestions = matches.reduce((sum, match) => sum + parseInt(match[1], 10), 0);
    }
    if (totalQuestions === 0) {
        setTimeError(null);
        return;
    }
    const lowerCaseSubject = subject.toLowerCase();
    const isSpecialSubject = lowerCaseSubject.includes('analyse') || lowerCaseSubject.includes('algebre');
    const timePerQuestion = isSpecialSubject ? 10.5 : 8.0;
    const estimatedMinutes = totalQuestions * timePerQuestion;
    const numSubQuestions = Number(subQuestions) || 0;
    const subQuestionBonusMinutes = numSubQuestions * 4;
    const tolerance = 1.15;
    const upperBoundMinutes = (estimatedMinutes * tolerance) + subQuestionBonusMinutes;

    const formatMinutesToHM = (mins: number) => {
        if (mins < 1) return "less than a minute";
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        const hStr = h > 0 ? `${h}h` : '';
        const mStr = m > 0 ? `${m}m` : '';
        return [hStr, mStr].filter(Boolean).join(' ');
    };

    if (userMinutes > upperBoundMinutes) {
        setTimeError(`Time limit is too high. For ${totalQuestions} question(s) in "${subject}", the maximum allowed time is ${formatMinutesToHM(upperBoundMinutes)}. (Estimated time: ~${formatMinutesToHM(estimatedMinutes)})`);
    } else {
        setTimeError(null);
    }
  }, [goal, subject, hours, minutes, subQuestions]);

  const handleUseTemplate = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const formattedDate = `${dd}/${mm}/25`;

    const template = `I will submit my homework on separate, numbered papers.
Each paper will have the date ${formattedDate} written at the top.
I will also send a screenshot of timer in forest showing the time approximately equal to the time spent on goal (uncertainty 10 mins +- 10 mins)
My homework will include:
Exercise X: Y Questions
I will make sure that all exercises and questions are clearly highlighted on each paper.`;
    setGoal(template);
  };

  const handleSubmit = useCallback(() => {
    const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (goal.trim() && subject.trim() && consequence.trim() && totalMinutes > 0 && startTime && endTime) {
      let finalGoal = goal.trim();
      const numSubQuestions = Number(subQuestions) || 0;

      if (numSubQuestions > 0) {
          finalGoal += `\n\n(Note for verifier: This assignment includes ${numSubQuestions} sub-questions in total that need to be completed.)`;
      }

      const payload: GoalPayload = {
            goal: finalGoal,
            subject: subject.trim(),
            timeLimit: { hours: Number(hours) || 0, minutes: Number(minutes) || 0 },
            consequence: consequence.trim(),
            startTime,
            endTime,
        };
      onGoalSubmit(payload);
    }
  }, [goal, subject, onGoalSubmit, hours, minutes, consequence, subQuestions, startTime, endTime]);

  const canSubmit = !goal.trim() || !subject.trim() || !consequence.trim() || !(Number(hours) > 0 || Number(minutes) > 0) || !!timeError || isLoading || !startTime || !endTime;

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-lg text-center animate-fade-in">
      <h2 className="text-2xl font-semibold mb-2 text-cyan-300">Add Goal to Plan</h2>
      <p className="text-slate-400 mb-6">Be specific! The AI will use this description to verify your proof of completion.</p>
      
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Goal Subject (e.g., 'Work', 'Analyse', 'Algebre')"
        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition mb-4"
        disabled={isLoading}
      />
      
      <div className="flex justify-between items-center mb-2">
        <label htmlFor="goal-textarea" className="text-slate-400 text-sm">Goal Description</label>
        <button
          onClick={handleUseTemplate}
          type="button"
          className="text-sm bg-slate-700 text-cyan-300 font-semibold py-1 px-3 rounded-md hover:bg-slate-600 transition-colors"
        >
          Use Template
        </button>
      </div>
      <textarea
        id="goal-textarea"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="e.g., 'Finish writing chapter 1 of my book, ensuring it is at least 3,000 words.'"
        className="w-full h-40 bg-slate-900 border border-slate-600 rounded-lg p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition mb-6"
        disabled={isLoading}
      />

      <div className="border-t border-slate-700 pt-6 mb-6 text-left space-y-4">
        <h3 className="text-slate-300 font-semibold text-lg">Set Time Range & Consequence</h3>
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Time Range</label>
            <div className="flex items-center gap-2">
                <input 
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                />
                <span className="text-slate-400">to</span>
                 <input 
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                />
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Estimated Time to Complete</label>
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
            <label htmlFor="sub-questions" className="block text-sm font-medium text-slate-400 mb-1">Number of Sub-questions (optional)</label>
            <p className="text-xs text-slate-500 mb-2">For questions like 3a, 3b, etc. Each adds 4 mins to the time margin.</p>
            <input
                id="sub-questions"
                type="number"
                value={subQuestions}
                onChange={(e) => setSubQuestions(e.target.value)}
                placeholder="e.g., 2"
                min="0"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white placeholder-slate-500 focus:ring-1 focus:ring-cyan-500"
                disabled={isLoading}
            />
        </div>
        {timeError && (
            <div className="mt-2">
                <Alert message={timeError} type="error" />
            </div>
        )}
         <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor="consequence" className="block text-sm font-medium text-slate-400">Consequence for Failure</label>
                <button
                  onClick={handleUseConsequenceTemplate}
                  type="button"
                  className="text-sm bg-slate-700 text-cyan-300 font-semibold py-1 px-3 rounded-md hover:bg-slate-600 transition-colors"
                >
                  Template
                </button>
            </div>
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


      <div className="flex gap-4">
        {onCancel && (
            <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="w-full bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-all duration-300"
            >
                Cancel
            </button>
        )}
        <button
            onClick={handleSubmit}
            disabled={canSubmit}
            className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        >
            {isLoading ? <Spinner /> : submitButtonText}
        </button>
      </div>
    </div>
  );
};

export default GoalSetter;
