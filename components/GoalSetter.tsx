import React, { useState, useCallback, useEffect } from 'react';
import Spinner from './Spinner';
import { PlannedGoal } from '../types';
import { fileToBase64 } from '../utils/fileUtils';

export interface GoalPayload {
    goal: string;
    subject: string;
    deadline: number;
    pdfAttachment?: { name: string; data: string; } | null;
}

interface GoalSetterProps {
  onGoalSubmit: (payload: GoalPayload) => void;
  isLoading: boolean;
  submitButtonText?: string;
  onCancel?: () => void;
  initialData?: PlannedGoal;
  planDate?: string;
}

const GoalSetter: React.FC<GoalSetterProps> = ({ onGoalSubmit, isLoading, submitButtonText = 'Set My Goal', onCancel, initialData, planDate }) => {
  const [goal, setGoal] = useState(initialData?.goal || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [deadline, setDeadline] = useState('');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdfName, setExistingPdfName] = useState(initialData?.pdfAttachment?.name || '');
  const [pdfRemoved, setPdfRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setGoal('');
    setSubject('');
    setDeadline('');
    setError(null);
    setPdfFile(null);
    setExistingPdfName('');
    setPdfRemoved(false);
  }, []);

  useEffect(() => {
    if (initialData) {
        setGoal(initialData.goal || '');
        setSubject(initialData.subject || '');
        if (initialData.deadline) {
            const d = new Date(initialData.deadline);
            // Format to YYYY-MM-DDTHH:mm which is required by datetime-local input
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            setDeadline(`${year}-${month}-${day}T${hours}:${minutes}`);
        } else {
            setDeadline('');
        }
        setExistingPdfName(initialData?.pdfAttachment?.name || '');
        setPdfFile(null);
        setPdfRemoved(false);
    }
  }, [initialData]);

  const handleUseTemplate = () => {
    let goalDate;
    if (planDate) {
        const [year, month, day] = planDate.split('-').map(Number);
        goalDate = new Date(year, month - 1, day);
    } else {
        goalDate = new Date();
    }

    const day = String(goalDate.getDate()).padStart(2, '0');
    const month = String(goalDate.getMonth() + 1).padStart(2, '0');
    const year = String(goalDate.getFullYear()).slice(-2);
    const formattedDate = `${day}/${month}/${year}`;
    
    const isCrmGoal = subject.toLowerCase().includes('crm');

    const template = isCrmGoal ?
`I will submit my homework on separate, numbered papers.
Each paper will have the date ${formattedDate} written at the top.
I will also send a screenshot of timer showing the time approximately equal to the time spent on goal (uncertainty 10 mins +- 10 mins)
My homework will include:
Repeat 1 and Repeat 2 that are copies of the pdf attached below.
I will make sure that all exercises Repeat and questions are clearly highlighted on each paper.`
    :
`I will submit my homework on separate, numbered papers.
Each paper will have the date ${formattedDate} written at the top.
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
    if (goal.trim() && subject.trim() && deadline) {
      const deadlineTimestamp = new Date(deadline).getTime();
      if (deadlineTimestamp <= Date.now()) {
          setError("Deadline must be in the future.");
          return;
      }
      setError(null);

      let pdfPayload: { name: string; data: string; } | null | undefined = undefined;
        if (pdfFile) {
            try {
                const base64Data = await fileToBase64(pdfFile);
                pdfPayload = { name: pdfFile.name, data: base64Data };
            } catch (error) {
                console.error("Error converting PDF to base64", error);
                setError("Could not process the PDF file. Please try re-selecting it.");
                return;
            }
        } else if (pdfRemoved) {
            pdfPayload = null; // Signal for deletion
        }

      const payload: GoalPayload = {
            goal: goal.trim(),
            subject: subject.trim(),
            deadline: deadlineTimestamp,
            pdfAttachment: pdfPayload
        };
      onGoalSubmit(payload);
      if (!initialData) {
        resetForm();
      }
    }
  }, [goal, subject, onGoalSubmit, deadline, pdfFile, pdfRemoved, initialData, resetForm]);

  const canSubmit = !goal.trim() || !subject.trim() || !deadline || !!error || isLoading;
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
        <h3 className="text-slate-300 font-semibold text-lg">Set Deadline</h3>
        <div>
          <label htmlFor="deadline-input" className="block text-sm font-medium text-slate-400 mb-1">Deadline</label>
          <input
            id="deadline-input"
            type="datetime-local"
            value={deadline}
            onChange={(e) => {
                setDeadline(e.target.value);
                setError(null);
            }}
            className="form-input w-full rounded-lg p-2 text-slate-200 placeholder-slate-500 transition"
          />
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
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
