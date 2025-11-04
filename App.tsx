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
import { formatDuration, getISODateString, formatCountdown, getStartOfWeekISOString } from './utils/timeUtils';
import { defaultWeeklyPlan } from './utils/defaultSchedule';

import Header from './components/Header';
import CodeUploader from './components/CodeUploader';
import TodaysPlanComponent from './components/TodaysPlan';
import WeeklyPlanView from './components/WeeklyPlanView';
import GoalSetter, { GoalPayload } from './components/GoalSetter';
import ProofUploader from './components/ProofUploader';
import VerificationResult from './components/VerificationResult';
import Alert from './components/Alert';
import GoalHistory from './components/GoalHistory';
import Auth from './components/Auth';
import ApiKeyPrompt from './components/ApiKeyPrompt';
import Spinner from './components/Spinner';
import { Chat } from '@google/genai';

type CompletionReason = 'verified' | 'skipped';

const calculateBreakFromSchedule = (completedGoal: PlannedGoal, allGoalsInPlan: PlannedGoal[]): number => {
    if (!completedGoal || !allGoalsInPlan) return 0;

    const sortedPendingGoals = allGoalsInPlan
        .filter(g => g.status === 'pending' && g.startTime)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const nextPlannedGoal = sortedPendingGoals[0];

    if (nextPlannedGoal && completedGoal.endTime) {
        try {
            const [endH, endM] = completedGoal.endTime.split(':').map(Number);
            const [startH, startM] = nextPlannedGoal.startTime.split(':').map(Number);
            
            const now = new Date();
            const endTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
            const startTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);

            if (startTimeToday > endTimeToday) {
                return startTimeToday.getTime() - endTimeToday.getTime();
            }
        } catch (e) {
            console.error("Error calculating break time from schedule:", e);
        }
    }
    return 0;
};

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem('GEMINI_API_KEY'));
  const [appState, setAppState] = useState<AppState>(AppState.TODAYS_PLAN);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeGoal, setActiveGoal] = useState<ActiveGoalState | null>(null);

  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [secretCodeImage, setSecretCodeImage] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true until auth state is known
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  
  const [goalSetTime, setGoalSetTime] = useState<number | null>(null);
  const [completionDuration, setCompletionDuration] = useState<string | null>(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState<number | null>(null);
  
  const [completionReason, setCompletionReason] = useState<CompletionReason | null>(null);
  const [activePlannedGoal, setActivePlannedGoal] = useState<PlannedGoal | null>(null);
  const [skippedGoalForReflection, setSkippedGoalForReflection] = useState<PlannedGoal | null>(null);

  const [availableBreakTime, setAvailableBreakTime] = useState<number | null>(null);
  const [appliedBreakTax, setAppliedBreakTax] = useState<number>(0);
  const [breakEndTime, setBreakEndTime] = useState<number | null>(null);
  const [completedSecretCode, setCompletedSecretCode] = useState<string | null>(null);
  const [completedSecretCodeImage, setCompletedSecretCodeImage] = useState<string | null>(null);
  const [nextGoal, setNextGoal] = useState<{
      secretCode?: string;
      secretCodeImage?: string;
      goal?: string;
      subject?: string;
      timeLimitInMs?: number | null;
      plannedGoalId?: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [chat, setChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ text: string, role: 'user' | 'model' }>>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [history, setHistory] = useState<CompletedGoal[]>([]);

  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [todaysPlan, setTodaysPlan] = useState<TodaysPlan | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => new Date(getStartOfWeekISOString(new Date())));
  const [weeklyPlans, setWeeklyPlans] = useState<TodaysPlan[] | null>([]);
  const [editingGoalInfo, setEditingGoalInfo] = useState<{ plan: TodaysPlan, goal: PlannedGoal } | null>(null);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
      if (!user) {
        setIsLoading(false);
        setHistory([]);
        setStreakData(null);
        setTodaysPlan(null);
        setActiveGoal(null);
        setWeeklyPlans(null);
      }
    });
    return () => unsubscribe();
  }, []);
  
  useEffect(() => {
    const intervalId = setInterval(() => {
        setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);
  
  useEffect(() => {
    if (infoMessage) {
        const timer = setTimeout(() => setInfoMessage(null), 7000);
        return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  useEffect(() => {
    if (!currentUser) return;

    const { uid } = currentUser;
    setIsLoading(true);
    let isInitialLoad = true;

    const listeners: Unsubscribe[] = [];

    listeners.push(dataService.listenToActiveGoal(uid, (goalState) => {
        setActiveGoal(goalState);
        if (goalState) {
            setSecretCode(goalState.secretCode);
            setSecretCodeImage(goalState.secretCodeImage);
            setGoal(goalState.goal);
            setSubject(goalState.subject);
            setGoalSetTime(goalState.goalSetTime);
            setTimeLimitInMs(goalState.timeLimitInMs);
            setAppState(AppState.GOAL_SET);
        } else {
            setAppState(currentState => {
                 if (
                    currentState !== AppState.GOAL_COMPLETED &&
                    currentState !== AppState.AWAITING_BREAK &&
                    currentState !== AppState.AWAITING_CODE &&
                    currentState !== AppState.BREAK_ACTIVE &&
                    currentState !== AppState.HISTORY_VIEW &&
                    currentState !== AppState.WEEKLY_PLAN_VIEW
                ) {
                    return AppState.TODAYS_PLAN;
                }
                return currentState;
            });
        }
    }));

    listeners.push(dataService.listenToPlan(uid, new Date(), (plan) => {
        setTodaysPlan(plan);
    }));
    
    listeners.push(dataService.listenToHistory(uid, setHistory));

    dataService.getStreakData(uid).then(async (data) => {
        let streak = data;
        const today = new Date();
        const currentWeekStart = getStartOfWeekISOString(today);

        if (!streak) {
            streak = { 
                currentStreak: 0, 
                lastCompletionDate: '', 
                commitment: null,
                skipsThisWeek: 0,
                weekStartDate: currentWeekStart,
                breakTimeTax: 0,
            };
        }
        
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

        if (!streak.weekStartDate || streak.weekStartDate !== currentWeekStart) {
            streak.skipsThisWeek = 0;
            streak.weekStartDate = currentWeekStart;
        }
        if (streak.skipsThisWeek === undefined) {
            streak.skipsThisWeek = 0;
        }
         if (streak.breakTimeTax === undefined) {
            streak.breakTimeTax = 0;
        }

        setStreakData(streak);
        if (!data || !data.weekStartDate) {
            dataService.saveStreakData(uid, streak);
        }

        // Ensure today's plan exists for all users
        const todaysDocument = await dataService.loadPlan(uid, today);
        if (!todaysDocument) {
            const dayIndex = (today.getDay() + 6) % 7; // Monday = 0
            const defaultDayPlanData = defaultWeeklyPlan[dayIndex];
            const newPlan: TodaysPlan = {
                date: getISODateString(today),
                goals: defaultDayPlanData.goals.map(goal => ({
                    ...goal,
                    id: `${getISODateString(today)}-${goal.startTime}-${Math.random()}`,
                    status: 'pending',
                })),
                todos: [],
            };
            await dataService.savePlan(uid, newPlan);
        }
    }).catch(err => {
        console.error("Failed to load streak data:", err);
        setError("Could not load your streak data.");
        const today = new Date();
        const currentWeekStart = getStartOfWeekISOString(today);
        const defaultStreak = { 
            currentStreak: 0, 
            lastCompletionDate: '', 
            commitment: null,
            skipsThisWeek: 0,
            weekStartDate: currentWeekStart,
            breakTimeTax: 0,
        };
        setStreakData(defaultStreak);
    }).finally(() => {
        if (isInitialLoad) {
            setIsLoading(false);
            isInitialLoad = false;
        }
    });

    return () => {
        listeners.forEach(unsubscribe => unsubscribe());
    };
}, [currentUser]);

  const handleSavePlan = (plan: TodaysPlan) => {
      if (!currentUser) return;
      if(plan.date === getISODateString(new Date())) {
        setTodaysPlan(plan);
      }
      dataService.savePlan(currentUser.uid, plan);
  };
    const handleSavePlanAndUpdateWeek = async (plan: TodaysPlan) => {
        if (!currentUser) return;
        await dataService.savePlan(currentUser.uid, plan);
        // Optimistically update local state instead of re-fetching to avoid race conditions.
        setWeeklyPlans(prevPlans => {
            if (!prevPlans) return [plan];
            const existingPlanIndex = prevPlans.findIndex(p => p.date === plan.date);
            if (existingPlanIndex > -1) {
                const updatedPlans = [...prevPlans];
                updatedPlans[existingPlanIndex] = plan;
                return updatedPlans;
            }
            return [...prevPlans, plan].sort((a,b) => a.date.localeCompare(b.date));
        });
    };

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

  const resetToStart = useCallback((isLogout = false) => {
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
    setCompletionReason(null); setActivePlannedGoal(null);
    setAvailableBreakTime(null); setBreakEndTime(null); setCompletedSecretCode(null); setCompletedSecretCodeImage(null);
    setNextGoal(null); setSkippedGoalForReflection(null);
  }, [currentUser]);

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
            secretCode: code, 
            secretCodeImage: tempSecretCodeImage!, 
            goal, 
            subject, 
            goalSetTime: goalStartTime, 
            timeLimitInMs
        };

        if (activePlannedGoal?.pdfAttachment) {
            activeState.pdfAttachment = activePlannedGoal.pdfAttachment;
        }
        
        await dataService.saveActiveGoal(currentUser.uid, activeState);
    } catch (err) {
        handleApiError(err);
        setSecretCodeImage(null);
    } finally {
        setIsLoading(false);
    }
  }, [handleApiError, goal, subject, timeLimitInMs, currentUser, activePlannedGoal]);

  const getEffectiveGoal = useCallback(() => {
    return goal;
  }, [goal]);

 const handleGoalSuccess = useCallback(async (feedback: VerificationFeedback | null, reason: CompletionReason) => {
    if (!currentUser) return;

    if (subject === "Accountability Reflection") {
        setIsLoading(true);
        const reflectionEndTime = Date.now();
        const reflectionDuration = goalSetTime ? reflectionEndTime - goalSetTime : 0;
        try {
            const goalSummary = "Completed accountability reflection";
            const reflectionEntry: Omit<CompletedGoal, 'firestoreId'> = { id: reflectionEndTime, goalSummary, fullGoal: goal, subject, startTime: goalSetTime!, endTime: reflectionEndTime, duration: reflectionDuration, completionReason: 'verified' };
            await dataService.addHistoryItem(currentUser.uid, reflectionEntry);
            await dataService.clearActiveGoal(currentUser.uid);

            let breakDurationMs = 0;
            if (skippedGoalForReflection && todaysPlan) {
                breakDurationMs = calculateBreakFromSchedule(skippedGoalForReflection, todaysPlan.goals);
            }
            setSkippedGoalForReflection(null);

            setCompletedSecretCode(secretCode);
            setCompletedSecretCodeImage(secretCodeImage);

            if (breakDurationMs > 0) {
                const nextPendingGoal = todaysPlan?.goals.filter(g => g.status === 'pending').sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
                if (nextPendingGoal) {
                    setNextGoal({
                        goal: nextPendingGoal.goal,
                        subject: nextPendingGoal.subject,
                        timeLimitInMs: nextPendingGoal.timeLimitInMs,
                        plannedGoalId: nextPendingGoal.id,
                    });
                    setAvailableBreakTime(breakDurationMs);
                    setBreakEndTime(Date.now() + breakDurationMs);
                    setAppState(AppState.BREAK_ACTIVE);
                } else {
                    setCompletionDuration(null);
                    setCompletionReason('skipped');
                    setVerificationFeedback(null);
                    setAppState(AppState.GOAL_COMPLETED);
                }
            } else {
                setCompletionDuration(null);
                setCompletionReason('skipped');
                setVerificationFeedback(null);
                setAppState(AppState.GOAL_COMPLETED);
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsLoading(false);
        }
        return;
    }

    setIsLoading(true);
    const endTime = Date.now();
    const duration = goalSetTime ? endTime - goalSetTime : 0;
    const finalGoal = getEffectiveGoal();

    try {
        const goalSummary = await summarizeGoal(finalGoal);
        const newEntry: Omit<CompletedGoal, 'firestoreId'> = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime!, endTime, duration, completionReason: reason };
        await dataService.addHistoryItem(currentUser.uid, newEntry);
    } catch (e) { console.error("Failed to save goal:", e); }

    if (reason === 'verified' && secretCodeImage && streakData) {
        setCompletedSecretCode(secretCode);
        setCompletedSecretCodeImage(secretCodeImage);
        const newData = { ...streakData, lastCompletedCodeImage: secretCodeImage };
        // Tax will be reset below, so we save the combined state change.
        setStreakData(newData); 
    }

    await dataService.clearActiveGoal(currentUser.uid);

    let breakDurationMs = 0;
    if (activePlannedGoal && todaysPlan) {
        const updatedGoals = todaysPlan.goals.map(g => g.id === activePlannedGoal.id ? { ...g, status: 'completed' } : g);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        await dataService.savePlan(currentUser.uid, updatedPlan);
        
        if (reason === 'verified') {
            breakDurationMs = calculateBreakFromSchedule(activePlannedGoal, updatedPlan.goals);
        }
        setActivePlannedGoal(null);
    }

    if (reason === 'verified' && streakData) {
        const tax = streakData.breakTimeTax || 0;
        if (tax > 0) {
            const finalBreakDuration = breakDurationMs - tax;
            setAppliedBreakTax(tax);
            breakDurationMs = finalBreakDuration > 0 ? finalBreakDuration : 0;
            setInfoMessage(`A focus tax of ${formatDuration(tax)} was deducted from your break.`);
        }
        const updatedStreakData = { ...streakData, breakTimeTax: 0, lastCompletedCodeImage: secretCodeImage || streakData.lastCompletedCodeImage };
        await dataService.saveStreakData(currentUser.uid, updatedStreakData);
        setStreakData(updatedStreakData);
    }

    if (reason === 'verified' && breakDurationMs > 0) {
        setCompletionDuration(formatDuration(duration));
        setVerificationFeedback(feedback);
        setCompletionReason('verified');

        const nextPendingGoal = todaysPlan?.goals.filter(g => g.status === 'pending').sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

        if (nextPendingGoal) {
            // Found the next goal, start the break for it.
            setNextGoal({
                goal: nextPendingGoal.goal,
                subject: nextPendingGoal.subject,
                timeLimitInMs: nextPendingGoal.timeLimitInMs,
                plannedGoalId: nextPendingGoal.id,
            });
            setAvailableBreakTime(breakDurationMs);
            setBreakEndTime(Date.now() + breakDurationMs);
            setAppState(AppState.BREAK_ACTIVE);
        } else {
            // No more pending goals for today.
            setAppState(AppState.GOAL_COMPLETED);
        }
        setIsLoading(false);
        return;
    }

    setCompletionDuration(formatDuration(duration));
    setCompletionReason(reason);
    setVerificationFeedback(feedback);
    setAppState(AppState.GOAL_COMPLETED);
    setIsLoading(false);
}, [currentUser, goal, goalSetTime, getEffectiveGoal, secretCode, secretCodeImage, subject, activePlannedGoal, todaysPlan, streakData, skippedGoalForReflection, handleApiError]);

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
        const result = await verifyGoalCompletion(finalGoal, imagePayloads);

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
        const response = await chat.sendMessage({ message });
        const jsonResponse = JSON.parse(response.text) as VerificationResultType;
        const newResult = jsonResponse;
        
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
  
  const handleSkipGoal = useCallback(async () => {
    if (!currentUser || !activeGoal || !streakData || !todaysPlan || !activePlannedGoal) return;
    setIsLoading(true); setError(null);
    try {
        const updatedStreakData = { ...streakData, skipsThisWeek: (streakData.skipsThisWeek ?? 0) + 1 };
        await dataService.saveStreakData(currentUser.uid, updatedStreakData);
        setStreakData(updatedStreakData);

        const updatedGoals = todaysPlan.goals.map(g => g.id === activePlannedGoal.id ? { ...g, status: 'skipped' } : g);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        await dataService.savePlan(currentUser.uid, updatedPlan);
        
        const reflectionGoalSetTime = Date.now();
        const reflectionActiveState: ActiveGoalState = {
            secretCode: activeGoal.secretCode,
            secretCodeImage: activeGoal.secretCodeImage,
            goal: "Write a few sentences on why the previous goal was skipped and what can be done differently next time. Submit a screenshot of your notes as proof.",
            subject: "Accountability Reflection",
            goalSetTime: reflectionGoalSetTime,
            timeLimitInMs: 5 * 60 * 1000,
        };
        
        setSkippedGoalForReflection(activePlannedGoal);
        await dataService.saveActiveGoal(currentUser.uid, reflectionActiveState);

    } catch (err) {
        handleApiError(err);
    } finally {
        setIsLoading(false);
    }
}, [currentUser, activeGoal, streakData, todaysPlan, activePlannedGoal, handleApiError]);


  const handleShowHistory = () => setAppState(AppState.HISTORY_VIEW);
  const handleHistoryBack = () => setAppState(AppState.TODAYS_PLAN);
  const handleDeleteHistoryItem = (firestoreDocId: string) => { if (currentUser) dataService.deleteHistoryItem(currentUser.uid, firestoreDocId); };
  const handleSetDailyCommitment = (text: string) => {
      if (!currentUser || !streakData) return;
      const todayStr = getISODateString(new Date());
      const newCommitment = { date: todayStr, text, completed: false };
      const newData = { ...streakData, commitment: newCommitment };
      setStreakData(newData);
      dataService.saveStreakData(currentUser.uid, newData);
  };
  const handleCompleteDailyCommitment = () => {
      if (!currentUser || !streakData || !streakData.commitment || streakData.commitment.completed) return;
      const todayStr = getISODateString(new Date());
      const newCommitment = { ...streakData.commitment, completed: true };
      const newStreak = streakData.lastCompletionDate === todayStr ? streakData.currentStreak : streakData.currentStreak + 1;
      const newData = { ...streakData, commitment: newCommitment, currentStreak: newStreak, lastCompletionDate: todayStr };
      setStreakData(newData);
      dataService.saveStreakData(currentUser.uid, newData);
  };

  const handleStartPlannedGoal = async (goalToStart: PlannedGoal) => {
    if (!currentUser) return;
    if (!goalToStart.goal || goalToStart.goal.trim() === '') {
        setError("Please edit the goal to add a description before starting. It cannot be empty.");
        window.scrollTo(0, 0);
        return;
    }
    setError(null);

    const parseTime = (timeStr: string): Date => {
        const [h, m] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(h, m, 0, 0);
        return date;
    };

    if (goalToStart.startTime && streakData && todaysPlan) {
        const now = new Date();
        const scheduledStartTime = parseTime(goalToStart.startTime);
        const delay = now.getTime() - scheduledStartTime.getTime();

        if (delay > 60000) { // More than 1 minute late
            const tax = Math.round(delay * 0.25);
            const newTax = (streakData.breakTimeTax || 0) + tax;
            
            setInfoMessage(`You're starting ${formatDuration(delay)} late. A ${formatDuration(tax)} 'focus tax' will be deducted from your next break.`);
            
            const goalDuration = goalToStart.timeLimitInMs ?? (parseTime(goalToStart.endTime).getTime() - parseTime(goalToStart.startTime).getTime());
            let lastEndTime = new Date(now.getTime() + goalDuration);
            const updatedGoals = [...todaysPlan.goals];
            let planWasUpdated = false;

            const goalsAfterThis = updatedGoals
                .filter(g => g.startTime > goalToStart.startTime && g.status === 'pending')
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

            for (const nextGoal of goalsAfterThis) {
                const nextScheduledStartTime = parseTime(nextGoal.startTime);
                if (nextScheduledStartTime < lastEndTime) {
                    const nextDuration = parseTime(nextGoal.endTime).getTime() - parseTime(nextGoal.startTime).getTime();
                    const newStartTime = lastEndTime;
                    const newEndTime = new Date(newStartTime.getTime() + nextDuration);
                    const formatTime = (date: Date) => `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                    
                    const goalIndexInPlan = updatedGoals.findIndex(g => g.id === nextGoal.id);
                    if (goalIndexInPlan !== -1) {
                        updatedGoals[goalIndexInPlan] = { ...updatedGoals[goalIndexInPlan], startTime: formatTime(newStartTime), endTime: formatTime(newEndTime) };
                        lastEndTime = newEndTime;
                        planWasUpdated = true;
                    }
                } else {
                    break;
                }
            }
            
            if (planWasUpdated) {
                const updatedPlan = { ...todaysPlan, goals: updatedGoals };
                await dataService.savePlan(currentUser.uid, updatedPlan);
                setInfoMessage(prev => `${prev ? prev + ' ' : ''}Subsequent goals have been shifted.`);
            }
            
            const newStreakData = { ...streakData, breakTimeTax: newTax };
            await dataService.saveStreakData(currentUser.uid, newStreakData);
            setStreakData(newStreakData);
        }
    }
    setGoal(goalToStart.goal);
    setSubject(goalToStart.subject);
    setTimeLimitInMs(goalToStart.timeLimitInMs);
    setActivePlannedGoal(goalToStart);
    setAppState(AppState.AWAITING_CODE);
};

  const handleEditGoal = (plan: TodaysPlan, goal: PlannedGoal) => {
    setEditingGoalInfo({ plan, goal });
  };
  const handleSaveEditedGoal = (payload: GoalPayload) => {
    if (!editingGoalInfo || !currentUser) return;
    const { plan, goal } = editingGoalInfo;
    const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
    
    const updatedGoal: PlannedGoal = {
        ...goal,
        goal: payload.goal,
        subject: payload.subject,
        timeLimitInMs: totalMs > 0 ? totalMs : null,
        startTime: payload.startTime,
        endTime: payload.endTime,
    };

    if (payload.pdfAttachment === null) {
      delete (updatedGoal as Partial<PlannedGoal>).pdfAttachment;
    } else if (payload.pdfAttachment) {
      updatedGoal.pdfAttachment = payload.pdfAttachment;
    }

    const updatedGoals = plan.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g);
    const updatedPlan = { ...plan, goals: updatedGoals };

    if (plan.date === getISODateString(new Date())) {
        handleSavePlan(updatedPlan);
    } else {
        handleSavePlanAndUpdateWeek(updatedPlan);
    }
    setEditingGoalInfo(null);
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
  const handleFinishBreakAndStartNextGoal = useCallback(async () => {
        if (!currentUser || !nextGoal?.goal || !nextGoal?.subject || !nextGoal?.secretCode || !nextGoal.secretCodeImage) {
            setError("Could not start next goal. Information was missing.");
            resetToStart();
            return;
        }
        const nextGoalTime = Date.now();
        const activeState: ActiveGoalState = {
            secretCode: nextGoal.secretCode, secretCodeImage: nextGoal.secretCodeImage, 
            goal: nextGoal.goal, subject: nextGoal.subject, goalSetTime: nextGoalTime, 
            timeLimitInMs: nextGoal.timeLimitInMs || null,
        };
        await dataService.saveActiveGoal(currentUser.uid, activeState);
        
        if (nextGoal.plannedGoalId && todaysPlan) {
            const plannedGoal = todaysPlan.goals.find(g => g.id === nextGoal.plannedGoalId);
            setActivePlannedGoal(plannedGoal || null);
        } else { setActivePlannedGoal(null); }
        
        setBreakEndTime(null); setAvailableBreakTime(null); setNextGoal(null);
        setVerificationFeedback(null); setChat(null); setChatMessages([]);
  }, [nextGoal, currentUser, todaysPlan, resetToStart]);

  useEffect(() => {
        if (appState === AppState.BREAK_ACTIVE && breakEndTime && breakEndTime - currentTime <= 0) {
            if (nextGoal?.secretCode && nextGoal?.secretCodeImage) {
                handleFinishBreakAndStartNextGoal();
            } else {
                setError("Break is over. A new lock code was not set in time. Please start your next goal from the plan.");
                resetToStart();
            }
        }
  }, [appState, breakEndTime, currentTime, handleFinishBreakAndStartNextGoal, nextGoal, resetToStart]);

    const handleShowWeeklyView = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        try {
            const plans = await dataService.loadWeeklyPlans(currentUser.uid, weekStartDate);
            setWeeklyPlans(plans);
            setAppState(AppState.WEEKLY_PLAN_VIEW);
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleNavigateWeek = async (direction: 'prev' | 'next') => {
        if (!currentUser) return;
        setIsLoading(true);
        const newWeekStartDate = new Date(weekStartDate);
        newWeekStartDate.setDate(weekStartDate.getDate() + (direction === 'next' ? 7 : -7));
        setWeekStartDate(newWeekStartDate);
        try {
            const plans = await dataService.loadWeeklyPlans(currentUser.uid, newWeekStartDate);
            setWeeklyPlans(plans);
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipBreak = () => {
        setInfoMessage("Break skipped. You can start your next goal when you're ready.");
        resetToStart();
    };

  const renderContent = () => {
    if (isLoading) return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    if (!apiKey) return <ApiKeyPrompt onSubmit={handleApiKeySubmit} error={error} />;
    if (!currentUser) return <Auth />;

    switch (appState) {
      case AppState.TODAYS_PLAN:
        return todaysPlan ? <TodaysPlanComponent 
            initialPlan={todaysPlan} 
            onSavePlan={handleSavePlan} 
            onStartGoal={handleStartPlannedGoal} 
            onShowHistory={handleShowHistory}
            onShowWeeklyView={handleShowWeeklyView}
            onEditGoal={handleEditGoal}
        /> : <div className="flex justify-center items-center p-8"><Spinner /></div>;
      case AppState.WEEKLY_PLAN_VIEW:
          return weeklyPlans ? <WeeklyPlanView
            initialPlans={weeklyPlans}
            weekStartDate={weekStartDate}
            onBack={() => setAppState(AppState.TODAYS_PLAN)}
            onSavePlan={handleSavePlanAndUpdateWeek}
            onStartGoal={handleStartPlannedGoal}
            onNavigateWeek={handleNavigateWeek}
            isLoading={isLoading}
            onEditGoal={handleEditGoal}
          /> : <div className="flex justify-center items-center p-8"><Spinner /></div>;
      case AppState.AWAITING_CODE: return <CodeUploader onCodeImageSubmit={handleCodeImageSubmit} isLoading={isLoading} onShowHistory={handleShowHistory} onLogout={handleLogout} currentUser={currentUser} streakData={streakData} onSetCommitment={handleSetDailyCommitment} onCompleteCommitment={handleCompleteDailyCommitment} />;
      case AppState.GOAL_SET: {
        const skipsLeft = 2 - (streakData?.skipsThisWeek ?? 0);
        return <ProofUploader goal={goal} onProofImageSubmit={handleProofImageSubmit} isLoading={isLoading} goalSetTime={goalSetTime} timeLimitInMs={timeLimitInMs} onSkipGoal={handleSkipGoal} skipsLeftThisWeek={skipsLeft > 0 ? skipsLeft : 0} lastCompletedCodeImage={streakData?.lastCompletedCodeImage} pdfAttachment={activeGoal?.pdfAttachment} />;
      }
      case AppState.HISTORY_VIEW: return <GoalHistory onBack={handleHistoryBack} history={history} onDeleteHistoryItem={handleDeleteHistoryItem} />;
      case AppState.GOAL_COMPLETED: return <VerificationResult isSuccess={true} secretCodeImage={secretCodeImage || completedSecretCodeImage} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} completionDuration={completionDuration} completionReason={completionReason} />;
      
      case AppState.BREAK_ACTIVE: {
            const timeLeft = breakEndTime ? breakEndTime - currentTime : 0;
            const codeSubmitted = !!nextGoal?.secretCode;
            const codeUploader = codeSubmitted ? 
                <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full h-full flex flex-col justify-center items-center text-center"><svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><h3 className="text-xl font-semibold text-green-400 mt-4">Next Code Accepted!</h3><p className="text-slate-300 mt-2">Enjoy the rest of your break. The next goal will start automatically.</p><button onClick={handleFinishBreakAndStartNextGoal} className="mt-6 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all button-glow-cyan">Start Next Goal Now</button></div>
                : <CodeUploader onCodeImageSubmit={handleNextCodeImageSubmit} isLoading={isLoading} onShowHistory={() => {}} onLogout={() => {}} currentUser={null} streakData={null} onSetCommitment={() => {}} onCompleteCommitment={() => {}} />;

            return (
                <div className="w-full max-w-2xl flex flex-col items-center gap-6">
                    <div className="w-full text-center bg-slate-900/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700"><p className="text-sm text-slate-400 uppercase tracking-wider">Break Ends In</p><p className={`text-3xl font-mono ${timeLeft < 60000 ? 'text-red-400' : 'text-cyan-300'}`}>{formatCountdown(timeLeft > 0 ? timeLeft : 0)}</p></div>
                    <div className="w-full flex flex-wrap justify-center items-start gap-6">
                        {completedSecretCodeImage && <div className="text-center flex-1 min-w-[280px]"><p className="text-slate-400 text-sm mb-2">Unlocked Code:</p><img src={completedSecretCodeImage} alt="Sequestered code" className="rounded-lg w-full border-2 border-green-500" /></div>}
                        <div className="flex-1 min-w-[320px]">{codeUploader}</div>
                    </div>
                    {nextGoal?.goal && <div className="w-full max-w-lg glass-panel p-4 rounded-2xl shadow-2xl text-center"><h3 className="text-md font-semibold text-slate-300 mb-1">Up Next: <span className="font-bold text-white">{nextGoal.subject}</span></h3></div>}
                     <button
                        onClick={handleSkipBreak}
                        className="mt-4 text-sm text-slate-500 hover:text-amber-400 transition-colors duration-300 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
                        </svg>
                        Skip Break & Return to Plan
                    </button>
                </div>
            );
        }

       default: return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    }
  };

  const editingModal = editingGoalInfo && (
    <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-fade-in overflow-y-auto"
        onClick={() => setEditingGoalInfo(null)}
    >
        <div className="flex items-center justify-center min-h-full p-4">
            <div onClick={e => e.stopPropagation()}>
                <GoalSetter 
                    initialData={editingGoalInfo.goal}
                    planDate={editingGoalInfo.plan.date}
                    onGoalSubmit={handleSaveEditedGoal}
                    isLoading={false} 
                    submitButtonText="Save Changes"
                    onCancel={() => setEditingGoalInfo(null)}
                />
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Header />
      <main className="w-full flex flex-col items-center justify-center">
        {error && <Alert message={error} type="error" />}
        {infoMessage && <Alert message={infoMessage} type="info" />}
        {editingModal}
        {appState === AppState.GOAL_SET && verificationFeedback ? (
            <div className="w-full max-w-lg mb-4 flex justify-center">
              <VerificationResult isSuccess={false} secretCodeImage={null} feedback={verificationFeedback} onRetry={handleRetry} onReset={() => resetToStart(false)} chatMessages={chatMessages} onSendChatMessage={handleSendChatMessage} isChatLoading={isChatLoading} />
            </div>
        ) : (
          renderContent()
        )}
      </main>
    </div>
  );
};

export default App;