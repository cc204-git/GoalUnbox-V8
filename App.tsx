
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
import { formatDuration, getISODateString } from './utils/timeUtils';
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
  const [completionTrigger, setCompletionTrigger] = useState<{ reason: CompletionReason | null }>({ reason: null });

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
    setCompletionTrigger({ reason: null });
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
            setVerificationFeedback(result.feedback);
            setCompletionTrigger({ reason: 'verified' });
            // isLoading remains true, handled by completion useEffect
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
  }, [getEffectiveGoal, handleApiError]);
  
  const handleSendChatMessage = useCallback(async (message: string) => {
    if (!chat) return;
    setIsChatLoading(true);
    setError(null);
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);

    try {
        const response = await chat.sendMessage(message);
        const jsonResponse = JSON.parse(response.text);
        const newResult = jsonResponse as VerificationResultType;
        setVerificationFeedback(newResult.feedback);
        setChatMessages(prev => [...prev, { role: 'model', text: newResult.feedback.summary }]);
        if (newResult.completed) {
            setTimeout(() => setCompletionTrigger({ reason: 'verified' }), 1500);
        }
    } catch (err) {
        const errorMessage = "The verifier couldn't process your message. Please try rephrasing.";
        setError(errorMessage);
        setChatMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
        setIsChatLoading(false);
    }
  }, [chat]);

  useEffect(() => {
      const saveAndCompleteGoal = async () => {
          if (!completionTrigger.reason || !goalSetTime) return;
          setIsLoading(true);
          const { reason } = completionTrigger;
          const endTime = Date.now();
          const duration = endTime - goalSetTime;
          const finalGoal = getEffectiveGoal();
          if (reason === 'emergency') setVerificationFeedback(null);
          
          try {
              const goalSummary = await summarizeGoal(finalGoal);
              const newEntry: CompletedGoal = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime, endTime, duration, completionReason: reason };
              const historyKey = currentUser ? null : 'goalUnboxHistory';
              const history = currentUser ? getUserHistory(currentUser) : JSON.parse(localStorage.getItem(historyKey!) || '[]');
              history.push(newEntry);
              if (currentUser) saveUserHistory(currentUser, history);
              else localStorage.setItem(historyKey!, JSON.stringify(history));
          } catch (e) { console.error("Failed to save goal:", e); }

          clearActiveGoal(currentUser);
          setCompletionDuration(formatDuration(duration > 0 ? duration : 0));
          setCompletionReason(reason);
          setAppState(AppState.GOAL_COMPLETED);
          setIsLoading(false);
          setCompletionTrigger({ reason: null });
      };
      saveAndCompleteGoal();
  }, [completionTrigger, goalSetTime, getEffectiveGoal, currentUser, subject]);

  const handleRetry = () => {
    setError(null);
    setVerificationFeedback(null);
    setChat(null);
    setChatMessages([]);
    setAppState(AppState.GOAL_SET);
  };

  const handleStartEmergency = () => { setError(null); setAppState(AppState.EMERGENCY_TEST); };
  const handleEmergencySuccess = useCallback(() => { setCompletionTrigger({ reason: 'emergency' }); }, []);
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
      case AppState.GOAL_COMPLETED: return <VerificationResult isSuccess={true} secretCodeImage={secretCodeImage} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} completionDuration={completionDuration} completionReason={completionReason} />;
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
        {appState === AppState.GOAL_SET && verificationFeedback && !completionTrigger.reason && (
            <div className="w-full max-w-lg mb-4">
                 <VerificationResult isSuccess={false} secretCodeImage={null} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} chatMessages={chatMessages} onSendChatMessage={handleSendChatMessage} isChatLoading={isChatLoading} />
            </div>
        )}
        {!(appState === AppState.GOAL_SET && verificationFeedback && !completionTrigger.reason) && renderContent()}
      </main>
    </div>
  );
};

export default App;