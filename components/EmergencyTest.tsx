
import React, { useState, useEffect, useCallback } from 'react';
import { generateFrenchTest, gradeFrenchTest, FrenchTestData, GradingResult, FrenchTestQuestion } from '../services/geminiService';
import Spinner from './Spinner';
import { formatCountdown } from '../utils/timeUtils';

interface EmergencyTestProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const EmergencyTest: React.FC<EmergencyTestProps> = ({ onSuccess, onCancel }) => {
  const [stage, setStage] = useState<'select' | 'loading' | 'testing' | 'grading' | 'results' | 'countdown'>('select');
  const [level, setLevel] = useState<'B2' | 'C1' | null>(null);
  const [testData, setTestData] = useState<FrenchTestData | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  const [testResult, setTestResult] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleLevelSelect = useCallback(async (selectedLevel: 'B2' | 'C1') => {
    setLevel(selectedLevel);
    setStage('loading');
    setError(null);
    setTestResult(null);
    setUserAnswers({});
    try {
      const data = await generateFrenchTest(selectedLevel);
      // Ensure we have questions before proceeding
      if (data && data.questions && data.questions.length > 0) {
        setTestData(data);
        setStage('testing');
      } else {
        throw new Error("The generated test was empty. Please try again.");
      }
    } catch (err) {
      setError((err as Error).message);
      setStage('select');
    }
  }, []);

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };
  
  const handleSubmitTest = useCallback(async () => {
    if (!testData) return;
    setStage('grading');
    setError(null);
    try {
      const result = await gradeFrenchTest(testData.questions, userAnswers);
      setTestResult(result);
      if (result.passed) {
        const delay = level === 'B2' ? 45 * 60 * 1000 : 15 * 60 * 1000;
        setCountdown(delay);
        setStage('countdown');
      } else {
        setStage('results');
      }
    } catch (err) {
      setError((err as Error).message);
      setStage('testing');
    }
  }, [testData, userAnswers, level]);

  useEffect(() => {
    if (stage !== 'countdown' || countdown === null) return;

    if (countdown <= 0) {
        onSuccess();
        return;
    }

    const timer = setInterval(() => {
        setCountdown(prev => (prev !== null ? prev - 1000 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [stage, countdown, onSuccess, level]);

  const renderLevelSelect = () => (
    <>
      <h2 className="text-2xl font-semibold mb-2 text-red-300">Emergency Exit</h2>
      <p className="text-slate-400 mb-6">Pass a French language test to get your code back early. Choose your challenge:</p>
      {error && <div className="p-4 rounded-md text-sm mb-6 bg-red-900/50 border border-red-500/50 text-red-300">{error}</div>}
      <div className="space-y-4">
        <button onClick={() => handleLevelSelect('B2')} className="w-full text-left p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-cyan-400 transition-colors">
            <p className="font-bold text-lg text-white">B2 Level Test (Intermediate)</p>
            <p className="text-slate-400">Code is released <span className="font-bold text-cyan-300">45 minutes</span> after passing.</p>
        </button>
        <button onClick={() => handleLevelSelect('C1')} className="w-full text-left p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-cyan-400 transition-colors">
            <p className="font-bold text-lg text-white">C1 Level Test (Advanced)</p>
            <p className="text-slate-400">Code is released <span className="font-bold text-cyan-300">15 minutes</span> after passing.</p>
        </button>
      </div>
       <button onClick={onCancel} className="mt-8 text-slate-500 hover:text-white transition-colors">Never mind, take me back</button>
    </>
  );

  const renderTest = () => (
    <>
      <h2 className="text-2xl font-semibold mb-4 text-cyan-300">French Test - {level?.toUpperCase()} Level</h2>
      <div className="text-left max-h-[80vh] overflow-y-auto p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-8">
        <div>
            <h3 className="font-bold text-lg text-slate-300 mb-2 border-b border-slate-700 pb-2">Part 1: Reading Comprehension</h3>
            <div className="bg-slate-800/50 p-4 rounded-lg space-y-4">
                <div>
                    <h4 className="font-semibold text-slate-400 text-sm">Texte (Niveau B2)</h4>
                    <p className="italic text-slate-300 whitespace-pre-wrap">{testData?.paragraphB2}</p>
                </div>
                <div>
                    <h4 className="font-semibold text-cyan-400 text-sm">Texte Amélioré (Niveau C1)</h4>
                    <p className="text-slate-200 whitespace-pre-wrap">{testData?.paragraphC1}</p>
                </div>
            </div>
        </div>

        <div className="space-y-6">
            {testData?.questions.slice(0, 10).map((q, i) => renderQuestion(q, i))}
        </div>

         <div>
            <h3 className="font-bold text-lg text-slate-300 mb-2 border-b border-slate-700 pb-2">Part 2: General Knowledge</h3>
        </div>
         <div className="space-y-6">
            {testData?.questions.slice(10, 20).map((q, i) => renderQuestion(q, i + 10))}
        </div>
      </div>
      <button onClick={handleSubmitTest} className="mt-6 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all">Submit Test</button>
    </>
  );

  const renderQuestion = (q: FrenchTestQuestion, index: number) => (
    <div key={index}>
        <p className="font-semibold text-slate-300 mb-3">{index + 1}. {q.question}</p>
        <div className="space-y-2">
            {q.options.map((option, i) => {
                const optionLetter = String.fromCharCode(65 + i);
                const id = `q${index}-o${i}`;
                return (
                    <label htmlFor={id} key={id} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${userAnswers[index] === optionLetter ? 'bg-cyan-900/50 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}>
                        <input
                            type="radio"
                            id={id}
                            name={`question-${index}`}
                            value={optionLetter}
                            checked={userAnswers[index] === optionLetter}
                            onChange={() => handleAnswerChange(index, optionLetter)}
                            className="hidden"
                        />
                        <span className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mr-3 flex items-center justify-center ${userAnswers[index] === optionLetter ? 'border-cyan-500 bg-cyan-500' : 'border-slate-500'}`}>
                            {userAnswers[index] === optionLetter && <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4"/></svg>}
                        </span>
                        <span>{optionLetter}. {option}</span>
                    </label>
                )
            })}
        </div>
    </div>
  );
  
  const renderResults = () => {
    if (!testResult) return null;
    const isPassed = testResult.passed;
    return (
      <>
        <h2 className={`text-3xl font-bold mb-4 ${isPassed ? 'text-green-400' : 'text-red-400'}`}>
            {isPassed ? 'Test Passed!' : 'Test Failed'}
        </h2>
        <p className="text-2xl text-white mb-6">Your Score: <span className="font-bold">{testResult.scorePercentage}%</span></p>
        {!isPassed && (
          <>
            <p className="text-slate-300 mb-6">You need at least 80% to pass. Here are your corrections:</p>
            <div className="text-left max-h-64 overflow-y-auto space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                {testResult.corrections.map((corr, i) => (
                    <div key={i} className="pb-2 border-b border-slate-700/50 last:border-b-0">
                        <p className="font-semibold text-slate-300">Question {corr.questionNumber}</p>
                        <p><span className="text-red-400 font-medium">Your Answer:</span> {corr.userAnswer}</p>
                        <p><span className="text-green-400 font-medium">Correct Answer:</span> {corr.correctAnswer}</p>
                        <p className="text-slate-400 mt-1"><span className="font-semibold">Explanation:</span> {corr.explanation}</p>
                    </div>
                ))}
                {testResult.corrections.length === 0 && <p className="text-slate-400 text-center">It looks like there was an issue grading. Please try again.</p>}
            </div>
            <button onClick={() => setStage('select')} className="mt-8 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400">Try Another Test</button>
            <button onClick={onCancel} className="mt-4 text-slate-500 hover:text-white transition-colors">Cancel Emergency</button>
          </>
        )}
      </>
    );
  };
  
  const renderCountdown = () => (
    <>
        <h2 className="text-3xl font-bold mb-4 text-green-400">Test Passed!</h2>
        <p className="text-slate-300 mb-2">Your score: <span className="font-bold">{testResult?.scorePercentage}%</span></p>
        <p className="text-slate-300 mb-6">Your code will be revealed in:</p>
        <div className="text-6xl font-mono text-cyan-300 p-6 bg-slate-900/50 rounded-lg border border-slate-700">
            {formatCountdown(countdown ?? 0)}
        </div>
    </>
  );

  const renderContent = () => {
    switch (stage) {
      case 'select': return renderLevelSelect();
      case 'loading': return <div className="flex flex-col items-center gap-4"><Spinner /><p>Generating your test...</p></div>;
      case 'testing': return renderTest();
      case 'grading': return <div className="flex flex-col items-center gap-4"><Spinner /><p>Grading your answers...</p></div>;
      case 'results': return renderResults();
      case 'countdown': return renderCountdown();
      default: return renderLevelSelect();
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-3xl text-center animate-fade-in">
        {renderContent()}
    </div>
  );
};

export default EmergencyTest;
