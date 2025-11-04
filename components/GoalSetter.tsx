import React, { useState, useCallback, useEffect, useMemo } from 'react';
import Spinner from './Spinner';
import Alert from './Alert';
import { PlannedGoal } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

interface TimeLimit {
    hours: number;
    minutes: number;
}
export interface GoalPayload {
    goal: string;
    subject: string;
    timeLimit: TimeLimit;
    startTime: string;
    endTime: string;
    pdfAttachment?: { name: string; data: string; } | null;
}

interface GoalSetterProps {
  onGoalSubmit: (payload: GoalPayload) => void;
  isLoading: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
  initialData?: PlannedGoal;
}

const GoalSetter: React.FC<GoalSetterProps> = ({ onGoalSubmit, isLoading, submitButtonText = 'Set My Goal', onCancel, initialData }) => {
  const [goal, setGoal] = useState(initialData?.goal || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  
  const initialTimeLimit = useMemo(() => {
    if (initialData?.timeLimitInMs) {
        const totalMinutes = Math.floor(initialData.timeLimitInMs / 60000);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return { hours: h > 0 ? h.toString() : '', minutes: m > 0 ? m.toString() : '' };
    }
    return { hours: '', minutes: '' };
  }, [initialData]);

  const [hours, setHours] = useState(initialTimeLimit.hours);
  const [minutes, setMinutes] = useState(initialTimeLimit.minutes);
  const [subQuestions, setSubQuestions] = useState('');
  const [startTime, setStartTime] = useState(initialData?.startTime || '');
  const [endTime, setEndTime] = useState(initialData?.endTime || '');
  const [timeError, setTimeError] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfName, setExistingPdfName] = useState(initialData?.pdfAttachment?.name || '');
  const [pdfRemoved, setPdfRemoved] = useState(false);

  useEffect(() => {
    if (initialData) {
        setGoal(initialData.goal || '');
        setSubject(initialData.subject || '');
        setStartTime(initialData.startTime || '');
        setEndTime(initialData.endTime || '');

        if (initialData.timeLimitInMs) {
            const totalMinutes = Math.floor(initialData.timeLimitInMs / 60000);
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            setHours(h > 0 ? h.toString() : '');
            setMinutes(m > 0 ? m.toString() : '');
        } else {
            setHours('');
            setMinutes('');
        }
        setExistingPdfName(initialData?.pdfAttachment?.name || '');
        setPdfFile(null);
        setPdfRemoved(false);
    }
  }, [initialData]);

  useEffect(() => {
    const formatMinutesToHM = (mins: number) => {
        if (mins < 1) return "less than a minute";
        const h = Math.floor(mins / 60);
        const m = Math.round(mins % 60);
        const hStr = h > 0 ? `${h}h` : '';
        const mStr = m > 0 ? `${m}m` : '';
        return [hStr, mStr].filter(Boolean).join(' ');
    };

    const userMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);

    const lowerCaseGoal = goal.toLowerCase();
    const hasExemptionKeyword = lowerCaseGoal.includes('devoir') || lowerCaseGoal.includes('probleme') || lowerCaseGoal.includes('serie');

    const lowerCaseSubject = subject.toLowerCase();
    if (hasExemptionKeyword || lowerCaseSubject.includes('crm')) {
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

    let timePerQuestion;
    if (lowerCaseSubject.includes('analyse') || lowerCaseSubject.includes('algebre')) {
        timePerQuestion = 18.0;
    } else if (lowerCaseSubject.includes('chimie')) {
        timePerQuestion = 8.0;
    } else {
        timePerQuestion = 12.0;
    }
    const estimatedMinutes = totalQuestions * timePerQuestion;
    const numSubQuestions = Number(subQuestions) || 0;
    const subQuestionBonusMinutes = numSubQuestions * 4;
    
    const tolerance = 1.15;
    const upperBoundMinutes = (estimatedMinutes * tolerance) + subQuestionBonusMinutes;

    if (userMinutes > 0 && userMinutes > upperBoundMinutes) {
        setTimeError(`Time limit is too high. For ${totalQuestions} question(s) in "${subject}", the maximum allowed time is ${formatMinutesToHM(upperBoundMinutes)}. (Estimated time: ~${formatMinutesToHM(estimatedMinutes)})`);
        return;
    }

    let goalLengthMinutes = 0;
    if (startTime && endTime) {
        try {
            const [startH, startM] = startTime.split(':').map(Number);
            const [endH, endM] = endTime.split(':').map(Number);
            
            const startDate = new Date();
            startDate.setHours(startH, startM, 0, 0);
            const endDate = new Date();
            endDate.setHours(endH, endM, 0, 0);

            if (endDate < startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }
            goalLengthMinutes = (endDate.getTime() - startDate.getTime()) / 60000;
        } catch (e) { /* Invalid time format, ignore */ }
    }

    if (goalLengthMinutes > 0) {
        const timeDiffTolerance = goalLengthMinutes >= 120 ? 30 : 15;
        const lowerBoundMinutes = goalLengthMinutes - timeDiffTolerance;

        if (estimatedMinutes < lowerBoundMinutes) {
            setTimeError(`The scheduled duration (${formatMinutesToHM(goalLengthMinutes)}) seems too long for the estimated work (~${formatMinutesToHM(estimatedMinutes)}). The schedule cannot exceed the estimate by more than ${timeDiffTolerance} minutes.`);
            return;
        }
    }

    setTimeError(null);
  }, [goal, subject, hours, minutes, subQuestions, startTime, endTime]);

  const handleUseTemplate = () => {
    const template = `I will submit my homework on separate, numbered papers.
Each paper will have the date DD/MM/YY written at the top.
I will also send a screenshot of timer showing the time approximately equal to the time spent on goal (uncertainty 10 mins +- 10 mins)
My homework will include:
Exercise X: Y Questions
I will make sure that all exercises and questions are clearly highlighted on each paper.`;
    setGoal(template);
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
        setPdfFile(file);
        setExistingPdfName(''); // new file overrides old one
        setPdfRemoved(false);
    } else {
        setPdfFile(null);
    }
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setExistingPdfName('');
    setPdfRemoved(true);
  };

  const handleSubmit = useCallback(async () => {
    const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
    if (goal.trim() && subject.trim() && totalMinutes > 0 && startTime && endTime) {
      let finalGoal = goal.trim();
      const numSubQuestions = Number(subQuestions) || 0;

      if (numSubQuestions > 0) {
          finalGoal += `\n\n(Note for verifier: This assignment includes ${numSubQuestions} sub-questions in total that need to be completed.)`;
      }

      let pdfPayload: { name: string; data: string; } | null | undefined = undefined;
        if (pdfFile) {
            try {
                const base64Data = await fileToBase64(pdfFile);
                pdfPayload = { name: pdfFile.name, data: base64Data };
            } catch (error) {
                console.error("Error converting PDF to base64", error);
                setTimeError("Could not process the PDF file. Please try re-selecting it.");
                return;
            }
        } else if (pdfRemoved) {
            pdfPayload = null; // Signal for deletion
        }

      const payload: GoalPayload = {
            goal: finalGoal,
            subject: subject.trim(),
            timeLimit: { hours: Number(hours) || 0, minutes: Number(minutes) || 0 },
            startTime,
            endTime,
            pdfAttachment: pdfPayload
        };
      onGoalSubmit(payload);
    }
  }, [goal, subject, onGoalSubmit, hours, minutes, subQuestions, startTime, endTime, pdfFile, pdfRemoved]);

  const canSubmit = !goal.trim() || !subject.trim() || !(Number(hours) > 0 || Number(minutes) > 0) || !!timeError || isLoading || !startTime || !endTime;
  const isCrmGoal = subject.toLowerCase().includes('crm');

  return (
    <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-lg text-center animate-fade-in">
      <h2 className="text-2xl font-semibold mb-2 text-cyan-300">{initialData ? 'Edit Goal' : 'Add Goal to Plan'}</h2>
      <p className="text-slate-400 mb-6">Be specific! The AI will use this description to verify your proof of completion.</p>
      
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Goal Subject (e.g., 'Work', 'Analyse', 'Algebre')"
        className="form-input w-full rounded-lg p-3 text-slate-200 placeholder-slate-500 transition mb-4"
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
        className="form-input w-full h-40 rounded-lg p-4 text-slate-200 placeholder-slate-500 transition mb-6"
        disabled={isLoading}
      />

      {isCrmGoal && (
        <div className="text-left mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">PDF Attachment for Correction</label>
            <div className="mt-1 flex items-center justify-center px-6 py-4 border-2 border-slate-600 border-dashed rounded-md bg-slate-900/20">
                <div className="space-y-1 text-center">
                    <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {pdfFile || existingPdfName ? (
                         <div className="text-sm text-green-400 flex items-center gap-4">
                            <p>{pdfFile?.name || existingPdfName}</p>
                            <button type="button" onClick={handleRemovePdf} className="font-medium text-red-400 hover:text-red-300">Remove</button>
                        </div>
                    ) : (
                        <div className="flex text-sm text-slate-500">
                            <label htmlFor="pdf-upload" className="relative cursor-pointer bg-slate-700 rounded-md font-medium text-cyan-300 hover:text-cyan-200 px-3 py-1">
                                <span>Upload a file</span>
                                <input id="pdf-upload" name="pdf-upload" type="file" className="sr-only" accept=".pdf" onChange={handlePdfChange} />
                            </label>
                        </div>
                    )}
                    <p className="text-xs text-slate-500">PDF only</p>
                </div>
            </div>
        </div>
      )}

      <div className="border-t border-slate-700 pt-6 mb-6 text-left space-y-4">
        <h3 className="text-slate-300 font-semibold text-lg">Set Time Range</h3>
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Time Range</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="form-input w-full rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
            />
            <span className="text-slate-400">to</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="form-input w-full rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
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
              className="form-input w-full rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
            />
            <input
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="Minutes"
              min="0"
              max="59"
              className="form-input w-full rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
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
            className="form-input w-full rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
            disabled={isLoading}
          />
        </div>
        {timeError && <div className="mt-2"><Alert message={timeError} type="error" /></div>}
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
          className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center button-glow-cyan"
        >
          {isLoading ? <Spinner /> : submitButtonText}
        </button>
      </div>
    </div>
  );
};

export default GoalSetter;
