
import React, { useState, useCallback, useEffect } from 'react';
import { AppState, CompletedGoal, ActiveGoalState, StreakData } from './types';
import { 
    extractCodeFromImage, 
    verifyGoalCompletion, 
    createVerificationChat, 
    VerificationResult as VerificationResultType, 
    VerificationFeedback,
    summarizeGoal 
} from './services/geminiService';
import { getUserHistory, saveUserHistory, getStreakData, saveStreakData } from './services/authService';
import { saveActiveGoal, loadActiveGoal, clearActiveGoal } from './services/goalStateService';
import { fileToBase64 } from './utils/fileUtils';
import { formatDuration, getISODateString, formatCountdown } from './utils/timeUtils';
import Header from './components/Header';
import CodeUploader from './components/CodeUploader';
import GoalSetter, { GoalPayload } from './components/GoalSetter';
import ProofUploader from './components/ProofUploader';
import VerificationResult from './components/VerificationResult';
import Alert from './components/Alert';
import EmergencyTest from './components/EmergencyTest';
import GoalHistory from './components/GoalHistory';
import Auth from './components/Auth';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import { Chat } from '@google/genai';
import Spinner from './components/Spinner';

type CompletionReason = 'verified' | 'emergency';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('GEMINI_API_KEY'));
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [secretCodeImage, setSecretCodeImage] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [goalSetTime, setGoalSetTime] = useState<number | null>(null);
  const [completionDuration, setCompletionDuration] = useState<string | null>(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState<number | null>(null);
  const [consequence, setConsequence] = useState<string | null>(null);
  
  const [completionReason, setCompletionReason] = useState<CompletionReason | null>(null);

  // --- Assure Feature State ---
  const [availableBreakTime, setAvailableBreakTime] = useState<number | null>(null);
  const [breakEndTime, setBreakEndTime] = useState<number | null>(null);
  const [completedSecretCodeImage, setCompletedSecretCodeImage] = useState<string | null>(null);
  const [nextGoal, setNextGoal] = useState<{
      secretCode?: string;
      secretCodeImage?: string;
      goal?: string;
      subject?: string;
      timeLimitInMs?: number | null;
      consequence?: string | null;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());


  const [chat, setChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ text: string, role: 'user' | 'model' }>>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<CompletedGoal[]>([]);

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  
  // Effect to handle auto-login
  useEffect(() => {
      if (apiKey) {
          const rememberedUser = localStorage.getItem('goalUnboxRememberedUser');
          if (rememberedUser) {
              handleLogin(rememberedUser, true, true); // auto-login
          } else {
              setAppState(AppState.AUTH);
          }
      }
      // If no apiKey, the ApiKeyPrompt will show, and this will re-run when it's set.
  }, [apiKey]);


  const clearApiKey = useCallback(() => {
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKey(null);
  }, []);
  
  const handleApiError = useCallback((err: unknown) => {
      const error = err as Error;
      if (error.message.includes("API Key is not valid")) {
          clearApiKey();
          setError("Your API Key is invalid. Please enter a valid one to continue.");
      } else {
          setError(error.message);
      }
  }, [clearApiKey]);

  const resetToStart = (isLogout: boolean = false) => {
    clearActiveGoal(currentUser);
    setAppState(isLogout ? AppState.AUTH : AppState.AWAITING_CODE);
    if (isLogout) {
      setCurrentUser(null);
      setStreakData(null);
    }
    setSecretCode(null);
    setSecretCodeImage(null);
    setGoal('');
    setSubject('');
    setVerificationFeedback(null);
    setIsLoading(false);
    setError(null);
    setChat(null);
    setChatMessages([]);
    setIsChatLoading(false);
    setGoalSetTime(null);
    setCompletionDuration(null);
    setTimeLimitInMs(null);
    setConsequence(null);
    setCompletionReason(null);
    // Assure Feature state reset
    setAvailableBreakTime(null);
    setBreakEndTime(null);
    setCompletedSecretCodeImage(null);
    setNextGoal(null);
  };
  
  const restoreSession = (email: string | null) => {
      const savedState = loadActiveGoal(email);
      if (savedState) {
          setSecretCode(savedState.secretCode);
          setSecretCodeImage(savedState.secretCodeImage);
          setGoal(savedState.goal);
          setSubject(savedState.subject);
          setGoalSetTime(savedState.goalSetTime);
          setTimeLimitInMs(savedState.timeLimitInMs);
          setConsequence(savedState.consequence);
          setAppState(AppState.GOAL_SET);
      } else {
          setAppState(AppState.AWAITING_CODE);
      }
  };

  const checkAndInitializeStreak = (email: string) => {
      let data = getStreakData(email);

      if (!data) { // For users created before this feature.
          data = { currentStreak: 0, lastCompletionDate: '', commitment: null };
      }

      const today = new Date();
      const todayStr = getISODateString(today);
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = getISODateString(yesterday);

      // If the last completion was not today or yesterday, reset streak.
      if (data.lastCompletionDate && data.lastCompletionDate !== todayStr && data.lastCompletionDate !== yesterdayStr) {
          data.currentStreak = 0;
      }

      // If the saved commitment is not for today, clear it.
      if (data.commitment && data.commitment.date !== todayStr) {
          data.commitment = null;
      }

      setStreakData(data);
      saveStreakData(email, data); // Save potentially updated data
  };

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setError(null);
  };

  const handleLogin = (email: string, rememberMe: boolean, isAutoLogin: boolean = false) => {
      if (rememberMe && !isAutoLogin) {
          localStorage.setItem('goalUnboxRememberedUser', email);
      } else if (!rememberMe) {
          localStorage.removeItem('goalUnboxRememberedUser');
      }
      setCurrentUser(email);
      checkAndInitializeStreak(email);
      restoreSession(email);
  };

  const handleContinueAsGuest = () => {
      localStorage.removeItem('goalUnboxRememberedUser');
      setCurrentUser(null);
      setStreakData(null);
      restoreSession(null);
  };
  
  const handleLogout = () => {
      localStorage.removeItem('goalUnboxRememberedUser');
      resetToStart(true);
  };
  
  const handleCodeImageSubmit = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
        const base64 = await fileToBase64(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => setSecretCodeImage(reader.result as string);

        const code = await extractCodeFromImage(base64, file.type);
        setSecretCode(code);
        setAppState(AppState.AWAITING_GOAL);
    } catch (err) {
        handleApiError(err);
        setSecretCodeImage(null);
    } finally {
        setIsLoading(false);
    }
  }, [handleApiError]);

  const handleGoalSubmit = useCallback((payload: GoalPayload) => {
    const goalStartTime = Date.now();
    let totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
    const newTimeLimitInMs = totalMs > 0 ? totalMs : null;
    
    setGoal(payload.goal);
    setSubject(payload.subject);
    setConsequence(payload.consequence);
    setTimeLimitInMs(newTimeLimitInMs);
    setGoalSetTime(goalStartTime);
    setAppState(AppState.GOAL_SET);

    if (secretCode && secretCodeImage) {
        const activeState: ActiveGoalState = { secretCode, secretCodeImage, goal: payload.goal, subject: payload.subject, goalSetTime: goalStartTime, timeLimitInMs: newTimeLimitInMs, consequence: payload.consequence };
        saveActiveGoal(currentUser, activeState);
    }
  }, [secretCode, secretCodeImage, currentUser]);
  
  const getEffectiveGoal = useCallback(() => {
    if (timeLimitInMs && goalSetTime && consequence && Date.now() > goalSetTime + timeLimitInMs) {
      return `The user's original goal was: "${goal}". They failed to meet the time limit. The consequence is: "${consequence}". The new combined goal is to complete BOTH the original goal AND the consequence.`;
    }
    return goal;
  }, [goal, timeLimitInMs, goalSetTime, consequence]);

  const handleGoalSuccess = useCallback(async (feedback: VerificationFeedback | null, reason: CompletionReason) => {
    setIsLoading(true);
    const endTime = Date.now();
    const duration = goalSetTime ? endTime - goalSetTime : 0;
    const finalGoal = reason === 'emergency' ? goal : getEffectiveGoal();

    try {
        const goalSummary = await summarizeGoal(finalGoal);
        const newEntry: CompletedGoal = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime!, endTime, duration, completionReason: reason };
        const historyKey = currentUser ? null : 'goalUnboxHistory';
        const currentHistory = currentUser ? getUserHistory(currentUser) : JSON.parse(localStorage.getItem(historyKey!) || '[]');
        currentHistory.push(newEntry);
        if (currentUser) saveUserHistory(currentUser, currentHistory);
        else localStorage.setItem(historyKey!, JSON.stringify(currentHistory));
    } catch (e) { console.error("Failed to save goal:", e); }

    clearActiveGoal(currentUser);

    if (reason === 'verified') {
        let breakDurationMs = 0;
        const twoHoursInMs = 2 * 60 * 60 * 1000;

        if (duration < twoHoursInMs) {
            // If the goal took less than 2 hours, give a 10-minute break.
            breakDurationMs = 10 * 60 * 1000;
        } else {
            // If 2 hours or more, use the proportional calculation: 15 mins per 2 hours.
            breakDurationMs = (duration / twoHoursInMs) * (15 * 60 * 1000);
        }

        if (breakDurationMs > 0) { // Offer break if any was calculated
            setAvailableBreakTime(breakDurationMs);
            setCompletionDuration(formatDuration(duration > 0 ? duration : 0));
            setCompletedSecretCodeImage(secretCodeImage);
            setVerificationFeedback(feedback);
            setAppState(AppState.AWAITING_BREAK);
            setIsLoading(false);
            return;
        }
    }

    // Default path for emergency or short goals
    setCompletionDuration(formatDuration(duration > 0 ? duration : 0));
    setCompletionReason(reason);
    setVerificationFeedback(feedback);
    setAppState(AppState.GOAL_COMPLETED);
    setIsLoading(false);
}, [currentUser, goal, goalSetTime, getEffectiveGoal, secretCodeImage, subject]);

  const handleProofImageSubmit = useCallback(async (files: File[]) => {
    const pauseStartTime = Date.now();
    setIsLoading(true);
    setError(null);
    setVerificationFeedback(null);
    setChat(null);
    setChatMessages([]);

    const resumeTimers = () => {
        const pausedMs = Date.now() - pauseStartTime;
        setGoalSetTime(prev => (prev ? prev + pausedMs : null));
    };

    try {
        const imagePayloads = await Promise.all(files.map(async (file) => ({ base64: await fileToBase64(file), mimeType: file.type })));
        const finalGoal = getEffectiveGoal();
        const result: VerificationResultType = await verifyGoalCompletion(finalGoal, imagePayloads);

        if (result.completed) {
            await handleGoalSuccess(result.feedback, 'verified');
        } else {
            resumeTimers();
            setVerificationFeedback(result.feedback);
            const chatSession = createVerificationChat(finalGoal, imagePayloads, result);
            setChat(chatSession);
            setChatMessages([{ role: 'model', text: result.feedback.summary }]);
            setIsLoading(false);
        }
    } catch (err) {
        resumeTimers();
        handleApiError(err);
        setIsLoading(false);
    }
  }, [getEffectiveGoal, handleApiError, handleGoalSuccess]);
  
  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!chat) return;
    setIsChatLoading(true);
    setError(null);
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);

    try {
        const response = await chat.sendMessage(message);
        const jsonResponse = JSON.parse(response.text);
        const newResult = jsonResponse as VerificationResultType;
        
        if (newResult.completed) {
             setChatMessages(prev => [...prev, { role: 'model', text: newResult.feedback.summary + "\n\nGoal is now complete!" }]);
            setTimeout(async () => {
                await handleGoalSuccess(newResult.feedback, 'verified');
            }, 1500);
        } else {
            setVerificationFeedback(newResult.feedback);
            setChatMessages(prev => [...prev, { role: 'model', text: newResult.feedback.summary }]);
        }
    } catch (err) {
        const errorMessage = "The verifier couldn't process your message. Please try rephrasing.";
        setError(errorMessage);
        setChatMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
        setIsChatLoading(false);
    }
  }, [chat, handleGoalSuccess]);

  const handleRetry = () => {
    setError(null);
    setVerificationFeedback(null);
    setChat(null);
    setChatMessages([]);
    setAppState(AppState.GOAL_SET);
  };

  const handleStartEmergency = () => { setError(null); setAppState(AppState.EMERGENCY_TEST); };
  const handleEmergencySuccess = useCallback(() => { handleGoalSuccess(null, 'emergency'); }, [handleGoalSuccess]);
  const handleEmergencyCancel = () => { setAppState(AppState.GOAL_SET); };
  
  const handleShowHistory = () => {
    const historyData = currentUser ? getUserHistory(currentUser) : JSON.parse(localStorage.getItem('goalUnboxHistory') || '[]');
    setHistory(historyData);
    setAppState(AppState.HISTORY_VIEW);
  };

  const handleDeleteHistoryItem = (idToDelete: number) => {
    const updatedHistory = history.filter(item => item.id !== idToDelete);
    setHistory(updatedHistory);
    if (currentUser) {
        saveUserHistory(currentUser, updatedHistory);
    } else {
        localStorage.setItem('goalUnboxHistory', JSON.stringify(updatedHistory));
    }
  };

  const handleSetDailyCommitment = (text: string) => {
      if (!currentUser || !streakData) return;
      const todayStr = getISODateString(new Date());
      const newCommitment = { date: todayStr, text, completed: false };
      const newData: StreakData = { ...streakData, commitment: newCommitment };
      setStreakData(newData);
      saveStreakData(currentUser, newData);
  };
    
  const handleCompleteDailyCommitment = () => {
      if (!currentUser || !streakData || !streakData.commitment || streakData.commitment.completed) return;
      
      const todayStr = getISODateString(new Date());
      const newCommitment = { ...streakData.commitment, completed: true };
      const newStreak = streakData.lastCompletionDate === todayStr ? streakData.currentStreak : streakData.currentStreak + 1;
      
      const newData: StreakData = {
          ...streakData,
          commitment: newCommitment,
          currentStreak: newStreak,
          lastCompletionDate: todayStr,
      };
      
      setStreakData(newData);
      saveStreakData(currentUser, newData);
  };

  // --- Assure Feature Handlers ---
    const handleStartBreak = () => {
        if (availableBreakTime) {
            setBreakEndTime(Date.now() + availableBreakTime);
            setAppState(AppState.BREAK_ACTIVE);
        }
    };

    const handleSkipBreak = () => {
        setCompletionReason('verified');
        setAppState(AppState.GOAL_COMPLETED);
    };

    const handleNextCodeImageSubmit = async (file: File) => {
        setIsLoading(true);
        setError(null);
        try {
            const base64 = await fileToBase64(file);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const dataUrl = reader.result as string;
                extractCodeFromImage(base64, file.type).then(code => {
                    setNextGoal({ secretCode: code, secretCodeImage: dataUrl });
                    setIsLoading(false);
                }).catch(err => {
                    handleApiError(err);
                    setIsLoading(false);
                });
            };
        } catch (err) {
            handleApiError(err);
            setIsLoading(false);
        }
    };

    const handleNextGoalSubmit = (payload: GoalPayload) => {
        let totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newTimeLimitInMs = totalMs > 0 ? totalMs : null;
        setNextGoal(prev => ({
            ...prev,
            goal: payload.goal,
            subject: payload.subject,
            timeLimitInMs: newTimeLimitInMs,
            consequence: payload.consequence,
        }));
    };
    
    // Timer effect
    useEffect(() => {
        if (appState !== AppState.BREAK_ACTIVE || !breakEndTime) {
            return;
        }

        const interval = setInterval(() => {
            setCurrentTime(Date.now());
            const timeLeft = breakEndTime - Date.now();
            if (timeLeft <= 0) {
                clearInterval(interval);
                if (nextGoal?.goal && nextGoal?.secretCode) {
                    const activeState: ActiveGoalState = {
                        secretCode: nextGoal.secretCode!,
                        secretCodeImage: nextGoal.secretCodeImage!,
                        goal: nextGoal.goal!,
                        subject: nextGoal.subject!,
                        goalSetTime: Date.now(),
                        timeLimitInMs: nextGoal.timeLimitInMs!,
                        consequence: nextGoal.consequence!,
                    };
                    saveActiveGoal(currentUser, activeState);
                    // Set all main states for the new goal
                    setSecretCode(activeState.secretCode);
                    setSecretCodeImage(activeState.secretCodeImage);
                    setGoal(activeState.goal);
                    setSubject(activeState.subject);
                    setGoalSetTime(activeState.goalSetTime);
                    setTimeLimitInMs(activeState.timeLimitInMs);
                    setConsequence(activeState.consequence);
                    setAppState(AppState.GOAL_SET);
                } else {
                    setAppState(AppState.BREAK_FAILED);
                }
                // Clear break states
                setBreakEndTime(null);
                setAvailableBreakTime(null);
                setNextGoal(null);
                setCompletedSecretCodeImage(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [appState, breakEndTime, currentUser, nextGoal]);

  const renderContent = () => {
    if (!apiKey) return <ApiKeyPrompt onSubmit={handleApiKeySubmit} error={error} />;

    switch (appState) {
      case AppState.AUTH: return <Auth onLogin={handleLogin} onContinueAsGuest={handleContinueAsGuest} />;
      case AppState.AWAITING_CODE: return <CodeUploader onCodeImageSubmit={handleCodeImageSubmit} isLoading={isLoading} onShowHistory={handleShowHistory} onLogout={handleLogout} currentUser={currentUser} streakData={streakData} onSetCommitment={handleSetDailyCommitment} onCompleteCommitment={handleCompleteDailyCommitment} />;
      case AppState.AWAITING_GOAL: return <GoalSetter onGoalSubmit={handleGoalSubmit} isLoading={isLoading} />;
      case AppState.GOAL_SET: return <ProofUploader goal={goal} onProofImageSubmit={handleProofImageSubmit} isLoading={isLoading} goalSetTime={goalSetTime} timeLimitInMs={timeLimitInMs} consequence={consequence} onStartEmergency={handleStartEmergency} />;
      case AppState.EMERGENCY_TEST: return <EmergencyTest onSuccess={handleEmergencySuccess} onCancel={handleEmergencyCancel} />;
      case AppState.HISTORY_VIEW:
        return <GoalHistory 
                    onBack={() => { setHistory([]); restoreSession(currentUser); }} 
                    history={history} 
                    onDeleteHistoryItem={handleDeleteHistoryItem} 
                />;
      case AppState.GOAL_COMPLETED: return <VerificationResult isSuccess={true} secretCodeImage={secretCodeImage || completedSecretCodeImage} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} completionDuration={completionDuration} completionReason={completionReason} />;
      
      case AppState.AWAITING_BREAK:
        return (
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in">
                <h2 className="text-3xl font-bold mb-4 text-green-400">Goal Completed!</h2>
                <p className="text-slate-300 mb-6">{verificationFeedback?.summary}</p>
                 <p className="text-slate-300 mb-6">You've earned a break of <strong className="text-cyan-300">{formatDuration(availableBreakTime ?? 0)}</strong>.</p>
                <div className="space-y-4">
                     <button onClick={handleStartBreak} className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all">Start Break & Reveal Code</button>
                    <button onClick={handleSkipBreak} className="w-full bg-slate-700 text-white font-semibold py-2 px-3 rounded-lg hover:bg-slate-600 transition-colors">Skip Break & Finish</button>
                </div>
            </div>
        );
      case AppState.BREAK_ACTIVE:
            const timeLeft = breakEndTime ? breakEndTime - currentTime : 0;
            return (
                <div className="w-full max-w-md flex flex-col items-center">
                    <div className="w-full text-center bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700 mb-6">
                        <p className="text-sm text-slate-400 uppercase tracking-wider">Break Ends In</p>
                        <p className={`text-3xl font-mono ${timeLeft < 60000 ? 'text-red-400' : 'text-cyan-300'}`}>{formatCountdown(timeLeft > 0 ? timeLeft : 0)}</p>
                    </div>
                    {completedSecretCodeImage && (
                        <div className="mb-6 text-center">
                            <p className="text-slate-400 text-sm mb-2">Your unlock code:</p>
                            <img src={completedSecretCodeImage} alt="Sequestered code" className="rounded-lg max-w-xs mx-auto border-2 border-green-500" />
                        </div>
                    )}
                    <div className="w-full">
                        {!nextGoal?.secretCode ? (
                            <CodeUploader onCodeImageSubmit={handleNextCodeImageSubmit} isLoading={isLoading} onShowHistory={handleShowHistory} onLogout={handleLogout} currentUser={currentUser} streakData={streakData} onSetCommitment={handleSetDailyCommitment} onCompleteCommitment={handleCompleteDailyCommitment}/>
                        ) : !nextGoal.goal ? (
                            <GoalSetter onGoalSubmit={handleNextGoalSubmit} isLoading={isLoading} />
                        ) : (
                            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center">
                                <h2 className="text-2xl font-semibold text-green-400 flex items-center justify-center gap-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    Next Goal is Set!
                                </h2>
                                <p className="text-slate-300 mt-2">Your new goal will begin automatically when the break is over.</p>
                            </div>
                        )}
                    </div>
                </div>
            );
       case AppState.BREAK_FAILED:
            return (
                <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in">
                    <Alert message="Break finished. You failed to set a new goal in time." type="error" />
                    <button onClick={() => resetToStart(false)} className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400">Start Over</button>
                </div>
            );
      default: return <Auth onLogin={handleLogin} onContinueAsGuest={handleContinueAsGuest} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
        <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
      <Header />
      <main className="w-full flex flex-col items-center justify-center">
        {error && appState !== AppState.AUTH && !apiKey && <div />}
        {error && (appState !== AppState.AUTH && apiKey) && <Alert message={error} type="error" />}
        {appState === AppState.GOAL_SET && verificationFeedback && (
            <div className="w-full max-w-lg mb-4">
                 <VerificationResult isSuccess={false} secretCodeImage={null} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} chatMessages={chatMessages} onSendChatMessage={handleSendChatMessage} isChatLoading={isChatLoading} />
            </div>
        )}
        {!(appState === AppState.GOAL_SET && verificationFeedback) && renderContent()}
      </main>
    </div>
  );
};

export default App;
