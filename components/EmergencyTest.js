import React, { useState, useEffect, useCallback } from 'react';
import { generateFrenchTest, gradeFrenchTest } from '../services/geminiService.js';
import Spinner from './Spinner.js';
import { formatCountdown } from '../utils/timeUtils.js';

const EmergencyTest = ({ onSuccess, onCancel }) => {
  const [stage, setStage] = useState('select');
  const [level, setLevel] = useState(null);
  const [testData, setTestData] = useState(null);
  const [userAnswers, setUserAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const handleLevelSelect = useCallback(async (selectedLevel) => {
    setLevel(selectedLevel);
    setStage('loading');
    setError(null);
    setTestResult(null);
    setUserAnswers({});
    try {
      const data = await generateFrenchTest(selectedLevel);
      if (data && data.questions && data.questions.length > 0) {
        setTestData(data);
        setStage('testing');
      } else {
        throw new Error("The generated test was empty. Please try again.");
      }
    } catch (err) {
      setError(err.message);
      setStage('select');
    }
  }, []);

  const handleAnswerChange = (questionIndex, answer) => {
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
      setError(err.message);
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

  const renderLevelSelect = () => React.createElement(
    React.Fragment,
    null,
    React.createElement('h2', { className: 'text-2xl font-semibold mb-2 text-red-300' }, 'Emergency Exit'),
    React.createElement('p', { className: 'text-slate-400 mb-6' }, 'Pass a French language test to get your code back early. Choose your challenge:'),
    error && React.createElement('div', { className: 'p-4 rounded-md text-sm mb-6 bg-red-900/50 border border-red-500/50 text-red-300' }, error),
    React.createElement(
      'div', { className: 'space-y-4' },
      React.createElement(
        'button', { onClick: () => handleLevelSelect('B2'), className: 'w-full text-left p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-cyan-400 transition-colors' },
        React.createElement('p', { className: 'font-bold text-lg text-white' }, 'B2 Level Test (Intermediate)'),
        React.createElement('p', { className: 'text-slate-400' }, 'Code is released ', React.createElement('span', { className: 'font-bold text-cyan-300' }, '45 minutes'), ' after passing.')
      ),
      React.createElement(
        'button', { onClick: () => handleLevelSelect('C1'), className: 'w-full text-left p-4 bg-slate-700/50 border border-slate-600 rounded-lg hover:border-cyan-400 transition-colors' },
        React.createElement('p', { className: 'font-bold text-lg text-white' }, 'C1 Level Test (Advanced)'),
        React.createElement('p', { className: 'text-slate-400' }, 'Code is released ', React.createElement('span', { className: 'font-bold text-cyan-300' }, '15 minutes'), ' after passing.')
      )
    ),
    React.createElement('button', { onClick: onCancel, className: 'mt-8 text-slate-500 hover:text-white transition-colors' }, 'Never mind, take me back')
  );

  const renderQuestion = (q, index) => React.createElement(
    'div', { key: index },
    React.createElement('p', { className: 'font-semibold text-slate-300 mb-3' }, `${index + 1}. ${q.question}`),
    React.createElement(
      'div', { className: 'space-y-2' },
      q.options.map((option, i) => {
        const optionLetter = String.fromCharCode(65 + i);
        const id = `q${index}-o${i}`;
        return React.createElement(
          'label', { htmlFor: id, key: id, className: `flex items-center p-3 rounded-lg border-2 cursor-pointer transition-colors ${userAnswers[index] === optionLetter ? 'bg-cyan-900/50 border-cyan-500' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}` },
          React.createElement('input', { type: 'radio', id: id, name: `question-${index}`, value: optionLetter, checked: userAnswers[index] === optionLetter, onChange: () => handleAnswerChange(index, optionLetter), className: 'hidden' }),
          React.createElement(
            'span', { className: `w-6 h-6 rounded-full border-2 flex-shrink-0 mr-3 flex items-center justify-center ${userAnswers[index] === optionLetter ? 'border-cyan-500 bg-cyan-500' : 'border-slate-500'}` },
            userAnswers[index] === optionLetter && React.createElement('svg', { className: 'w-3 h-3 text-white fill-current', viewBox: '0 0 16 16' }, React.createElement('circle', { cx: '8', cy: '8', r: '4' }))
          ),
          React.createElement('span', null, `${optionLetter}. ${option}`)
        );
      })
    )
  );

  const renderTest = () => React.createElement(
    React.Fragment,
    null,
    React.createElement('h2', { className: 'text-2xl font-semibold mb-4 text-cyan-300' }, `French Test - ${level?.toUpperCase()} Level`),
    React.createElement(
      'div', { className: 'text-left max-h-[80vh] overflow-y-auto p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-8' },
      React.createElement(
        'div', null,
        React.createElement('h3', { className: 'font-bold text-lg text-slate-300 mb-2 border-b border-slate-700 pb-2' }, 'Part 1: Reading Comprehension'),
        React.createElement(
          'div', { className: 'bg-slate-800/50 p-4 rounded-lg space-y-4' },
          React.createElement('div', null,
            React.createElement('h4', { className: 'font-semibold text-slate-400 text-sm' }, 'Texte (Niveau B2)'),
            React.createElement('p', { className: 'italic text-slate-300 whitespace-pre-wrap' }, testData?.paragraphB2)
          ),
          React.createElement('div', null,
            React.createElement('h4', { className: 'font-semibold text-cyan-400 text-sm' }, 'Texte Amélioré (Niveau C1)'),
            React.createElement('p', { className: 'text-slate-200 whitespace-pre-wrap' }, testData?.paragraphC1)
          )
        )
      ),
      React.createElement('div', { className: 'space-y-6' }, testData?.questions.slice(0, 10).map((q, i) => renderQuestion(q, i))),
      React.createElement('div', null, React.createElement('h3', { className: 'font-bold text-lg text-slate-300 mb-2 border-b border-slate-700 pb-2' }, 'Part 2: General Knowledge')),
      React.createElement('div', { className: 'space-y-6' }, testData?.questions.slice(10, 20).map((q, i) => renderQuestion(q, i + 10)))
    ),
    React.createElement('button', { onClick: handleSubmitTest, className: 'mt-6 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all' }, 'Submit Test')
  );

  const renderResults = () => {
    if (!testResult) return null;
    const isPassed = testResult.passed;
    return React.createElement(
      React.Fragment,
      null,
      React.createElement('h2', { className: `text-3xl font-bold mb-4 ${isPassed ? 'text-green-400' : 'text-red-400'}` }, isPassed ? 'Test Passed!' : 'Test Failed'),
      React.createElement('p', { className: 'text-2xl text-white mb-6' }, 'Your Score: ', React.createElement('span', { className: 'font-bold' }, `${testResult.scorePercentage}%`)),
      !isPassed && React.createElement(
        React.Fragment,
        null,
        React.createElement('p', { className: 'text-slate-300 mb-6' }, 'You need at least 80% to pass. Here are your corrections:'),
        React.createElement(
          'div', { className: 'text-left max-h-64 overflow-y-auto space-y-4 bg-slate-900/50 p-4 rounded-lg border border-slate-700' },
          testResult.corrections.map((corr, i) => React.createElement(
            'div', { key: i, className: 'pb-2 border-b border-slate-700/50 last:border-b-0' },
            React.createElement('p', { className: 'font-semibold text-slate-300' }, `Question ${corr.questionNumber}`),
            React.createElement('p', null, React.createElement('span', { className: 'text-red-400 font-medium' }, 'Your Answer:'), ` ${corr.userAnswer}`),
            React.createElement('p', null, React.createElement('span', { className: 'text-green-400 font-medium' }, 'Correct Answer:'), ` ${corr.correctAnswer}`),
            React.createElement('p', { className: 'text-slate-400 mt-1' }, React.createElement('span', { className: 'font-semibold' }, 'Explanation:'), ` ${corr.explanation}`)
          )),
          testResult.corrections.length === 0 && React.createElement('p', { className: 'text-slate-400 text-center' }, 'It looks like there was an issue grading. Please try again.')
        ),
        React.createElement('button', { onClick: () => setStage('select'), className: 'mt-8 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400' }, 'Try Another Test'),
        React.createElement('button', { onClick: onCancel, className: 'mt-4 text-slate-500 hover:text-white transition-colors' }, 'Cancel Emergency')
      )
    );
  };
  
  const renderCountdown = () => React.createElement(
    React.Fragment,
    null,
    React.createElement('h2', { className: 'text-3xl font-bold mb-4 text-green-400' }, 'Test Passed!'),
    React.createElement('p', { className: 'text-slate-300 mb-2' }, 'Your score: ', React.createElement('span', { className: 'font-bold' }, `${testResult?.scorePercentage}%`)),
    React.createElement('p', { className: 'text-slate-300 mb-6' }, 'Your code will be revealed in:'),
    React.createElement('div', { className: 'text-6xl font-mono text-cyan-300 p-6 bg-slate-900/50 rounded-lg border border-slate-700' }, formatCountdown(countdown ?? 0))
  );

  const renderContent = () => {
    switch (stage) {
      case 'select': return renderLevelSelect();
      case 'loading': return React.createElement('div', { className: 'flex flex-col items-center gap-4' }, React.createElement(Spinner, null), React.createElement('p', null, 'Generating your test...'));
      case 'testing': return renderTest();
      case 'grading': return React.createElement('div', { className: 'flex flex-col items-center gap-4' }, React.createElement(Spinner, null), React.createElement('p', null, 'Grading your answers...'));
      case 'results': return renderResults();
      case 'countdown': return renderCountdown();
      default: return renderLevelSelect();
    }
  };

  return React.createElement(
    'div',
    { className: 'bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-3xl text-center animate-fade-in' },
    renderContent()
  );
};

export default EmergencyTest;
