
import React, { useState, useCallback, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { Unsubscribe } from 'firebase/firestore';
import { AppState, CompletedGoal, ActiveGoalState, StreakData, TodaysPlan, PlannedGoal } from './types';
import { 
    extractCodeFromImage, 
    verifyGoalCompletion, 
    createVerificationChat, 
    VerificationResult as VerificationResultType, 
    VerificationFeedback,
    summarizeGoal 
} from './services/geminiService';
import { auth } from './services/firebaseService';
import * as authService from './services/authService';
import * as dataService from './services/dataService';
import { fileToBase64 } from './utils/fileUtils';
import { formatDuration, getISODateString, formatCountdown } from './utils/timeUtils';

import Header from './components/Header';
import CodeUploader from './components/CodeUploader';
import TodaysPlanComponent from './components/TodaysPlan';
import GoalSetter, { GoalPayload } from './components/GoalSetter';
import ProofUploader from './components/ProofUploader';
import VerificationResult from './components/VerificationResult';
import Alert from './components/Alert';
import EmergencyTest from './components/EmergencyTest';
import GoalHistory from './components/GoalHistory';
import Auth from './components/Auth';
import ApiKeyPrompt from './components/ApiKeyPrompt';
// FIX: Added missing import for Spinner component.
import Spinner from './components/Spinner';
import { Chat } from '@google/genai';

type CompletionReason = 'verified' | 'emergency';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('GEMINI_API_KEY'));
  const [appState, setAppState] = useState<AppState>(AppState.AUTH);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeGoal, setActiveGoal] = useState<ActiveGoalState | null>(null);

  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [secretCodeImage, setSecretCodeImage] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true until auth state is known
  const [error, setError] = useState<string | null>(null);
  
  const [goalSetTime, setGoalSetTime] = useState<number | null>(null);
  const [completionDuration, setCompletionDuration] = useState<string | null>(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState<number | null>(null);
  const [consequence, setConsequence] = useState<string | null>(null);
  
  const [completionReason, setCompletionReason] = useState<CompletionReason | null>(null);
  const [activePlannedGoal, setActivePlannedGoal] = useState<PlannedGoal | null>(null);

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
      plannedGoalId?: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [breakChoice, setBreakChoice] = useState<'new' | 'plan' | null>(null);
  const [breakChoiceCountdown, setBreakChoiceCountdown] = useState<number | null>(null);


  const [chat, setChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ text: string, role: 'user' | 'model' }>>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<CompletedGoal[]>([]);

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [todaysPlan, setTodaysPlan] = useState<TodaysPlan | null>(null);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (!user) {
        setIsLoading(false);
        setAppState(AppState.AUTH);
        // Clear all data states
        setHistory([]);
        setStreakData(null);
        setTodaysPlan(null);
        setActiveGoal(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const { uid } = currentUser;
    setIsLoading(true);
    let isInitialLoad = true;

    const listeners: Unsubscribe[] = [];

    // Listener for active goal
    listeners.push(dataService.listenToActiveGoal(uid, (goalState) => {
        setActiveGoal(goalState);
        if (goalState) {
            setSecretCode(goalState.secretCode);
            setSecretCodeImage(goalState.secretCodeImage);
            setGoal(goalState.goal);
            setSubject(goalState.subject);
            setGoalSetTime(goalState.goalSetTime);
            setTimeLimitInMs(goalState.timeLimitInMs);
            setConsequence(goalState.consequence);
            setAppState(AppState.GOAL_SET);
        } else if (
            appState !== AppState.GOAL_COMPLETED &&
            appState !== AppState.AWAITING_BREAK &&
            appState !== AppState.AWAITING_CODE
        ) {
            setAppState(AppState.TODAYS_PLAN);
        }
    }));

    // Listener for today's plan
    listeners.push(dataService.listenToPlan(uid, new Date(), (plan) => {
        if (!plan) {
            const defaultGoal1: PlannedGoal = {
                id: `default-${new Date().getTime()}-1`,
                subject: "Anki Review", goal: "Upload a verification of finishing all anki flash cards. I must upload a screenshot from my Windows computer. One half of the screen must show the Anki 'Congratulations!' screen (or similar proof of completion), and the other half must show the current date. The date in the screenshot must match today's date.",
                timeLimitInMs: 3600000, consequence: null, startTime: "", endTime: "", completed: false,
            };
            const defaultGoal2: PlannedGoal = {
                id: `default-${new Date().getTime()}-2`,
                subject: "Anki Creation", goal: "I must send verification of me uploading flashcards to anki. I must upload a screenshot from my Windows computer. One half of the screen must show the Anki interface after adding new cards, and the other half must show the current date. The date in the screenshot must match today's date.",
                timeLimitInMs: null, consequence: null, startTime: "", endTime: "", completed: false,
            };
            const newPlan = { date: getISODateString(new Date()), goals: [defaultGoal1, defaultGoal2] };
            dataService.savePlan(uid, newPlan);
            setTodaysPlan(newPlan);
        } else {
            setTodaysPlan(plan);
        }
    }));
    
    // Listener for history
    listeners.push(dataService.listenToHistory(uid, setHistory));

    // Fetch initial streak data
    dataService.getStreakData(uid).then(data => {
        let streak = data;
        if (!streak) {
            streak = { currentStreak: 0, lastCompletionDate: '', commitment: null };
        }
        const today = new Date();
        const todayStr = getISODateString(today);
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = getISODateString(yesterday);

        if (streak.lastCompletionDate && streak.lastCompletionDate !== todayStr && streak.lastCompletionDate !== yesterdayStr) {
            streak.currentStreak = 0;
        }
        if (streak.commitment && streak.commitment.date !== todayStr) {
            streak.commitment = null;
        }
        setStreakData(streak);
        if (!data) dataService.saveStreakData(uid, streak);
    }).finally(() => {
        if (isInitialLoad) {
            setIsLoading(false);
            isInitialLoad = false;
        }
    });

    return () => {
        listeners.forEach(unsubscribe => unsubscribe());
    };
}, [currentUser, appState]);

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
    if (currentUser) dataService.clearActiveGoal(currentUser.uid);
    if (isLogout) {
      authService.signOut();
    } else {
        setAppState(AppState.TODAYS_PLAN);
    }
    setSecretCode(null); setSecretCodeImage(null); setGoal(''); setSubject('');
    setVerificationFeedback(null); setIsLoading(false); setError(null);
    setChat(null); setChatMessages([]); setIsChatLoading(false);
    setGoalSetTime(null); setCompletionDuration(null); setTimeLimitInMs(null);
    setConsequence(null); setCompletionReason(null); setActivePlannedGoal(null);
    setAvailableBreakTime(null); setBreakEndTime(null); setCompletedSecretCodeImage(null);
    setNextGoal(null); setBreakChoice(null);
  };

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setError(null);
  };
  
  const handleLogout = () => {
      resetToStart(true);
  };
  
  const handleCodeImageSubmit = useCallback(async (file: File) => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    
    let tempSecretCodeImage: string | null = null;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    const imagePromise = new Promise<void>(resolve => {
        reader.onload = () => {
            tempSecretCodeImage = reader.result as string;
            setSecretCodeImage(tempSecretCodeImage);
            resolve();
        };
    });

    try {
        const base64 = await fileToBase64(file);
        await imagePromise;

        const code = await extractCodeFromImage(base64, file.type);
        setSecretCode(code);
        
        const goalStartTime = Date.now();
        setGoalSetTime(goalStartTime);
        
        const activeState: ActiveGoalState = { 
            secretCode: code, secretCodeImage: tempSecretCodeImage!, goal, subject, 
            goalSetTime: goalStartTime, timeLimitInMs, consequence 
        };
        await dataService.saveActiveGoal(currentUser.uid, activeState);
        // Listener will set app state

    } catch (err) {
        handleApiError(err);
        setSecretCodeImage(null);
    } finally {
        setIsLoading(false);
    }
  }, [handleApiError, goal, subject, timeLimitInMs, consequence, currentUser]);

  const getEffectiveGoal = useCallback(() => {
    if (timeLimitInMs && goalSetTime && consequence && Date.now() > goalSetTime + timeLimitInMs) {
      return `The user's original goal was: "${goal}". They failed to meet the time limit. The consequence is: "${consequence}". The new combined goal is to complete BOTH the original goal AND the consequence.`;
    }
    return goal;
  }, [goal, timeLimitInMs, goalSetTime, consequence]);

  const handleGoalSuccess = useCallback(async (feedback: VerificationFeedback | null, reason: CompletionReason) => {
    if (!currentUser) return;
    setIsLoading(true);
    const endTime = Date.now();
    const duration = goalSetTime ? endTime - goalSetTime : 0;
    const finalGoal = reason === 'emergency' ? goal : getEffectiveGoal();

    try {
        const goalSummary = await summarizeGoal(finalGoal);
        const newEntry: CompletedGoal = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime!, endTime, duration, completionReason: reason };
        await dataService.addHistoryItem(currentUser.uid, newEntry);
    } catch (e) { console.error("Failed to save goal:", e); }

    if (reason === 'verified' && secretCodeImage && streakData) {
        const newData = { ...streakData, lastCompletedCodeImage: secretCodeImage };
        setStreakData(newData); // Optimistic update for UI
        await dataService.saveStreakData(currentUser.uid, newData);
    }

    await dataService.clearActiveGoal(currentUser.uid);

    if (activePlannedGoal && todaysPlan) {
        const updatedGoals = todaysPlan.goals.map(g => g.id === activePlannedGoal.id ? { ...g, completed: true } : g);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        await dataService.savePlan(currentUser.uid, updatedPlan);
        setActivePlannedGoal(null);
    }

    if (reason === 'verified') {
        let breakDurationMs = (duration < 7200000) ? 600000 : (duration / 7200000) * 900000;
        if (breakDurationMs > 0) {
            setAvailableBreakTime(breakDurationMs);
            setCompletionDuration(formatDuration(duration));
            setCompletedSecretCodeImage(secretCodeImage);
            setVerificationFeedback(feedback);
            setAppState(AppState.AWAITING_BREAK);
            setIsLoading(false);
            return;
        }
    }

    setCompletionDuration(formatDuration(duration));
    setCompletionReason(reason);
    setVerificationFeedback(feedback);
    setAppState(AppState.GOAL_COMPLETED);
    setIsLoading(false);
}, [currentUser, goal, goalSetTime, getEffectiveGoal, secretCodeImage, subject, activePlannedGoal, todaysPlan, streakData]);

  const handleProofImageSubmit = useCallback(async (files: File[]) => {
    const pauseStartTime = Date.now();
    setIsLoading(true); setError(null); setVerificationFeedback(null); setChat(null); setChatMessages([]);

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
    setIsChatLoading(true); setError(null);
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);

    try {
        // FIX: chat.sendMessage expects an object, not a string.
        const response = await chat.sendMessage({ message });
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
    setError(null); setVerificationFeedback(null); setChat(null); setChatMessages([]);
    setAppState(AppState.GOAL_SET);
  };

  const handleStartEmergency = () => { setError(null); setAppState(AppState.EMERGENCY_TEST); };
  const handleEmergencySuccess = useCallback(() => { handleGoalSuccess(null, 'emergency'); }, [handleGoalSuccess]);
  const handleEmergencyCancel = () => { setAppState(AppState.GOAL_SET); };
  
  const handleShowHistory = () => setAppState(AppState.HISTORY_VIEW);
  const handleHistoryBack = () => setAppState(AppState.TODAYS_PLAN);

  const handleDeleteHistoryItem = (firestoreDocId: string) => {
    if (currentUser) dataService.deleteHistoryItem(currentUser.uid, firestoreDocId);
  };

  const handleSetDailyCommitment = (text: string) => {
      if (!currentUser || !streakData) return;
      const todayStr = getISODateString(new Date());
      const newCommitment = { date: todayStr, text, completed: false };
      const newData: StreakData = { ...streakData, commitment: newCommitment };
      setStreakData(newData);
      dataService.saveStreakData(currentUser.uid, newData);
  };
    
  const handleCompleteDailyCommitment = () => {
      if (!currentUser || !streakData || !streakData.commitment || streakData.commitment.completed) return;
      
      const todayStr = getISODateString(new Date());
      const newCommitment = { ...streakData.commitment, completed: true };
      const newStreak = streakData.lastCompletionDate === todayStr ? streakData.currentStreak : streakData.currentStreak + 1;
      
      const newData: StreakData = {
          ...streakData, commitment: newCommitment, currentStreak: newStreak, lastCompletionDate: todayStr,
      };
      setStreakData(newData);
      dataService.saveStreakData(currentUser.uid, newData);
  };

    const handleSavePlan = (plan: TodaysPlan) => {
        if (!currentUser) return;
        setTodaysPlan(plan);
        dataService.savePlan(currentUser.uid, plan);
    };

    const handleStartPlannedGoal = (goalToStart: PlannedGoal) => {
        setGoal(goalToStart.goal); setSubject(goalToStart.subject);
        setTimeLimitInMs(goalToStart.timeLimitInMs); setConsequence(goalToStart.consequence);
        setActivePlannedGoal(goalToStart); setAppState(AppState.AWAITING_CODE);
    };

    const handleStartBreak = useCallback(() => {
        if (availableBreakTime) {
            setBreakEndTime(Date.now() + availableBreakTime);
            setAppState(AppState.BREAK_ACTIVE);
        }
    }, [availableBreakTime]);

    const handleSkipBreak = () => {
        setCompletionReason('verified'); setAppState(AppState.GOAL_COMPLETED);
    };

    const handleNextCodeImageSubmit = async (file: File) => {
        setIsLoading(true); setError(null);
        try {
            const base64 = await fileToBase64(file);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const dataUrl = reader.result as string;
                extractCodeFromImage(base64, file.type).then(code => {
                    setNextGoal(prev => ({ ...prev, secretCode: code, secretCodeImage: dataUrl }));
                    setIsLoading(false);
                }).catch(err => { handleApiError(err); setIsLoading(false); });
            };
        } catch (err) { handleApiError(err); setIsLoading(false); }
    };

    const handleNextGoalSubmit = (payload: GoalPayload) => {
        let totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newTimeLimitInMs = totalMs > 0 ? totalMs : null;
        setNextGoal(prev => ({ ...prev, goal: payload.goal, subject: payload.subject, timeLimitInMs: newTimeLimitInMs, consequence: payload.consequence }));
    };
    
    const handleSelectPlannedGoalForNext = (goalToSelect: PlannedGoal) => {
        setNextGoal({
            goal: goalToSelect.goal, subject: goalToSelect.subject, timeLimitInMs: goalToSelect.timeLimitInMs,
            consequence: goalToSelect.consequence, plannedGoalId: goalToSelect.id,
        });
    };

    const startNextGoal = useCallback(async () => {
        if (!currentUser || !nextGoal?.goal || !nextGoal?.secretCode || !nextGoal.secretCodeImage) {
            setAppState(AppState.BREAK_FAILED); return;
        }
        const nextGoalTime = Date.now();
        const activeState: ActiveGoalState = {
            secretCode: nextGoal.secretCode, secretCodeImage: nextGoal.secretCodeImage, goal: nextGoal.goal,
            subject: nextGoal.subject!, goalSetTime: nextGoalTime, timeLimitInMs: nextGoal.timeLimitInMs!, consequence: nextGoal.consequence!,
        };
        await dataService.saveActiveGoal(currentUser.uid, activeState);
        
        if (nextGoal.plannedGoalId && todaysPlan) {
            const plannedGoal = todaysPlan.goals.find(g => g.id === nextGoal.plannedGoalId);
            setActivePlannedGoal(plannedGoal || null);
        } else { setActivePlannedGoal(null); }
        
        setBreakEndTime(null); setAvailableBreakTime(null); setNextGoal(null);
        setCompletedSecretCodeImage(null); setBreakChoice(null);
        setVerificationFeedback(null); setChat(null); setChatMessages([]);
        // The listener on activeGoal will transition the state
    }, [nextGoal, currentUser, todaysPlan]);
    
    useEffect(() => {
        if (appState !== AppState.BREAK_ACTIVE || !breakEndTime) return;
        const interval = setInterval(() => {
            const now = Date.now();
            setCurrentTime(now);
            if (breakEndTime - now <= 0) {
                clearInterval(interval);
                if (nextGoal?.goal && nextGoal?.secretCode) {
                    startNextGoal();
                } else { setAppState(AppState.BREAK_FAILED); }
                setBreakEndTime(null); setAvailableBreakTime(null); setNextGoal(null);
                setCompletedSecretCodeImage(null); setBreakChoice(null);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [appState, breakEndTime, nextGoal, startNextGoal]);

    useEffect(() => {
        let intervalId: number | undefined;
        if (appState === AppState.AWAITING_BREAK) {
            setBreakChoiceCountdown(10);
            intervalId = window.setInterval(() => {
                setBreakChoiceCountdown(prev => {
                    if (prev === null || prev <= 1) {
                        clearInterval(intervalId);
                        handleStartBreak(); return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (breakChoiceCountdown !== null) { setBreakChoiceCountdown(null); }
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [appState, handleStartBreak]);

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    if (!apiKey) return <ApiKeyPrompt onSubmit={handleApiKeySubmit} error={error} />;
    if (!currentUser) return <Auth />;

    switch (appState) {
      case AppState.TODAYS_PLAN:
        return todaysPlan ? <TodaysPlanComponent initialPlan={todaysPlan} onSavePlan={handleSavePlan} onStartGoal={handleStartPlannedGoal} currentUser={currentUser.uid} /> : <div className="flex justify-center items-center p-8"><Spinner /></div>;
      case AppState.AWAITING_CODE: return <CodeUploader onCodeImageSubmit={handleCodeImageSubmit} isLoading={isLoading} onShowHistory={handleShowHistory} onLogout={handleLogout} currentUser={currentUser} streakData={streakData} onSetCommitment={handleSetDailyCommitment} onCompleteCommitment={handleCompleteDailyCommitment} />;
      case AppState.GOAL_SET: return <ProofUploader goal={goal} onProofImageSubmit={handleProofImageSubmit} isLoading={isLoading} goalSetTime={goalSetTime} timeLimitInMs={timeLimitInMs} consequence={consequence} onStartEmergency={handleStartEmergency} lastCompletedCodeImage={streakData?.lastCompletedCodeImage} />;
      case AppState.EMERGENCY_TEST: return <EmergencyTest onSuccess={handleEmergencySuccess} onCancel={handleEmergencyCancel} />;
      case AppState.HISTORY_VIEW: return <GoalHistory onBack={handleHistoryBack} history={history} onDeleteHistoryItem={handleDeleteHistoryItem} />;
      case AppState.GOAL_COMPLETED: return <VerificationResult isSuccess={true} secretCodeImage={secretCodeImage || completedSecretCodeImage} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} completionDuration={completionDuration} completionReason={completionReason} />;
      
      case AppState.AWAITING_BREAK:
        return ( <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in">
                <h2 className="text-3xl font-bold mb-4 text-green-400">Goal Completed!</h2>
                <p className="text-slate-300 mb-6">{verificationFeedback?.summary}</p>
                 <p className="text-slate-300 mb-6">You've earned a break of <strong className="text-cyan-300">{formatDuration(availableBreakTime ?? 0)}</strong>.</p>
                <div className="space-y-4">
                     <button onClick={handleStartBreak} className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all">
                        Start Break & Reveal Code {breakChoiceCountdown !== null && ` (${breakChoiceCountdown})`}
                    </button>
                    <button onClick={handleSkipBreak} className="w-full bg-slate-700 text-white font-semibold py-2 px-3 rounded-lg hover:bg-slate-600 transition-colors">Skip Break & Finish</button>
                </div>
            </div> );
      case AppState.BREAK_ACTIVE:
            const timeLeft = breakEndTime ? breakEndTime - currentTime : 0;
            const uncompletedGoals = (todaysPlan?.goals.filter(g => !g.completed) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const readyForNextGoal = nextGoal?.goal && nextGoal?.secretCode;
            return ( <div className="w-full max-w-2xl flex flex-col items-center gap-6">
                    <div className="w-full text-center bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700">
                        <p className="text-sm text-slate-400 uppercase tracking-wider">Break Ends In</p>
                        <p className={`text-3xl font-mono ${timeLeft < 60000 ? 'text-red-400' : 'text-cyan-300'}`}>{formatCountdown(timeLeft > 0 ? timeLeft : 0)}</p>
                    </div>
                    {completedSecretCodeImage && ( <div className="text-center">
                            <p className="text-slate-400 text-sm mb-2">Your previous unlock code:</p>
                            <img src={completedSecretCodeImage} alt="Sequestered code" className="rounded-lg max-w-xs mx-auto border-2 border-green-500" />
                        </div> )}
                    <div className="w-full max-w-lg flex justify-center">
                        {readyForNextGoal ? ( <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center">
                                <h2 className="text-2xl font-semibold text-green-400 flex items-center justify-center gap-2">
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                    Next Goal is Ready!
                                </h2>
                                <p className="text-slate-300 mt-2 mb-6">Your new goal will begin automatically when the break is over.</p>
                                <button onClick={startNextGoal} className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400">
                                    Skip Break & Start Now
                                </button>
                            </div>
                        ) : !breakChoice ? ( <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center">
                                <h2 className="text-xl font-semibold mb-4 text-slate-200">Prepare Your Next Goal</h2>
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button onClick={() => setBreakChoice('plan')} className="flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors" disabled={uncompletedGoals.length === 0}>
                                        Choose from Plan {uncompletedGoals.length === 0 && "(None Left)"}
                                    </button>
                                    <button onClick={() => setBreakChoice('new')} className="flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors">
                                        Set a New Goal
                                    </button>
                                </div>
                            </div>
                        ) : breakChoice === 'new' && !nextGoal?.secretCode ? ( <CodeUploader onCodeImageSubmit={handleNextCodeImageSubmit} isLoading={isLoading} onShowHistory={()=>{}} onLogout={()=>{}} currentUser={null} streakData={null} onSetCommitment={()=>{}} onCompleteCommitment={()=>{}}/>
                        ) : breakChoice === 'new' && !nextGoal?.goal ? ( <GoalSetter onGoalSubmit={handleNextGoalSubmit} isLoading={false} submitButtonText="Set Next Goal" onCancel={() => setNextGoal(null)} />
                        ) : breakChoice === 'plan' && !nextGoal?.goal ? ( <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-lg shadow-2xl w-full text-center">
                                <h2 className="text-xl font-semibold mb-4 text-slate-200">Select Next Goal from Plan</h2>
                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                    {uncompletedGoals.map(g => ( <div key={g.id} className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-left flex items-center justify-between gap-4">
                                            <div>
                                                <p className="font-mono text-sm text-cyan-300">{g.startTime} - {g.endTime}</p>
                                                <p className="font-bold text-white mt-1">{g.subject}</p>
                                                <p className="text-xs text-slate-400">{g.goal.substring(0, 70)}...</p>
                                            </div>
                                            <button onClick={() => handleSelectPlannedGoalForNext(g)} className="bg-cyan-500 text-slate-900 font-bold py-2 px-3 rounded-lg hover:bg-cyan-400 text-sm flex-shrink-0">Select</button>
                                        </div> ))}
                                </div>
                                <button onClick={() => setBreakChoice(null)} className="mt-4 text-slate-400 hover:text-white text-sm">Back</button>
                             </div>
                        ) : breakChoice === 'plan' && !nextGoal?.secretCode ? ( <CodeUploader onCodeImageSubmit={handleNextCodeImageSubmit} isLoading={isLoading} onShowHistory={()=>{}} onLogout={()=>{}} currentUser={null} streakData={null} onSetCommitment={()=>{}} onCompleteCommitment={()=>{}}/>
                        ) : null}
                    </div>
                </div> );
       case AppState.BREAK_FAILED:
            return ( <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in">
                    <Alert message="Break finished. You failed to set a new goal in time." type="error" />
                    <button onClick={() => resetToStart(false)} className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400">Back to Plan</button>
                </div> );
      default: return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
        <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
      <Header />
      <main className="w-full flex flex-col items-center justify-center">
        {error && <Alert message={error} type="error" />}
        {appState === AppState.GOAL_SET && verificationFeedback && (
            <div className="w-full max-w-lg mb-4 flex justify-center">
                 <VerificationResult isSuccess={false} secretCodeImage={null} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} chatMessages={chatMessages} onSendChatMessage={handleSendChatMessage} isChatLoading={isChatLoading} />
            </div>
        )}
        {!(appState === AppState.GOAL_SET && verificationFeedback) && renderContent()}
      </main>
    </div>
  );
};

export default App;