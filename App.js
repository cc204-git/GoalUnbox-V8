import React, { useState, useCallback, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { AppState } from './types.js';
import { 
    extractCodeFromImage, 
    verifyGoalCompletion, 
    createVerificationChat, 
    summarizeGoal 
} from './services/geminiService.js';
import { auth } from './services/firebaseService.js';
import * as authService from './services/authService.js';
import * as dataService from './services/dataService.js';
import { fileToBase64 } from './utils/fileUtils.js';
import { formatDuration, getISODateString, formatCountdown, getStartOfWeekISOString } from './utils/timeUtils.js';

import Header from './components/Header.js';
import CodeUploader from './components/CodeUploader.js';
import TodaysPlanComponent from './components/TodaysPlan.js';
import WeeklyPlanView from './components/WeeklyPlanView.js';
import GoalSetter from './components/GoalSetter.js';
import ProofUploader from './components/ProofUploader.js';
import VerificationResult from './components/VerificationResult.js';
import Alert from './components/Alert.js';
import GoalHistory from './components/GoalHistory.js';
import Auth from './components/Auth.js';
import ApiKeyPrompt from './components/ApiKeyPrompt.js';
import Spinner from './components/Spinner.js';

const calculateBreakFromSchedule = (completedGoal, allGoalsInPlan) => {
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

const App = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY'));
  const [appState, setAppState] = useState(AppState.TODAYS_PLAN);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);

  const [secretCode, setSecretCode] = useState(null);
  const [secretCodeImage, setSecretCodeImage] = useState(null);
  const [goal, setGoal] = useState('');
  const [subject, setSubject] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [goalSetTime, setGoalSetTime] = useState(null);
  const [completionDuration, setCompletionDuration] = useState(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState(null);
  const [consequence, setConsequence] = useState(null);
  
  const [completionReason, setCompletionReason] = useState(null);
  const [activePlannedGoal, setActivePlannedGoal] = useState(null);

  const [availableBreakTime, setAvailableBreakTime] = useState(null);
  const [breakEndTime, setBreakEndTime] = useState(null);
  const [completedSecretCode, setCompletedSecretCode] = useState(null);
  const [completedSecretCodeImage, setCompletedSecretCodeImage] = useState(null);
  const [nextGoal, setNextGoal] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [breakChoice, setBreakChoice] = useState(null);
  const [nextGoalSelectionCountdown, setNextGoalSelectionCountdown] = useState(null);

  const [chat, setChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const [streakData, setStreakData] = useState(null);
  const [todaysPlan, setTodaysPlan] = useState(null);
  const [weekStartDate, setWeekStartDate] = useState(() => new Date(getStartOfWeekISOString(new Date())));
  const [weeklyPlans, setWeeklyPlans] = useState(null);
  const [editingGoalInfo, setEditingGoalInfo] = useState(null);

  
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
    if (!currentUser) return;

    const { uid } = currentUser;
    setIsLoading(true);
    let isInitialLoad = true;

    const listeners = [];

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
            appState !== AppState.AWAITING_CODE &&
            appState !== AppState.BREAK_ACTIVE &&
            appState !== AppState.HISTORY_VIEW &&
            appState !== AppState.WEEKLY_PLAN_VIEW
        ) {
            setAppState(AppState.TODAYS_PLAN);
        }
    }));

    listeners.push(dataService.listenToPlan(uid, new Date(), (plan) => {
        if (!plan && !isInitialLoad) {
            const newPlan = { date: getISODateString(new Date()), goals: [] };
            dataService.savePlan(uid, newPlan);
            setTodaysPlan(newPlan);
        } else {
            setTodaysPlan(plan);
        }
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
                weekStartDate: currentWeekStart
            };
            await dataService.createDefaultWeeklyPlan(uid, today);
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

        setStreakData(streak);
        if (!data || !data.weekStartDate) {
            dataService.saveStreakData(uid, streak);
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
            weekStartDate: currentWeekStart
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
}, [currentUser, appState]);

  const handleSavePlan = (plan) => {
      if (!currentUser) return;
      if(plan.date === getISODateString(new Date())) {
        setTodaysPlan(plan);
      }
      dataService.savePlan(currentUser.uid, plan);
  };
    const handleSavePlanAndUpdateWeek = async (plan) => {
        if (!currentUser) return;
        await dataService.savePlan(currentUser.uid, plan);
        // After saving, refresh the weekly view data
        const plans = await dataService.loadWeeklyPlans(currentUser.uid, weekStartDate);
        setWeeklyPlans(plans);
    };

  const clearApiKey = useCallback(() => {
    localStorage.removeItem('GEMINI_API_KEY');
    setApiKey(null);
  }, []);
  
  const handleApiError = useCallback((err) => {
      const error = err;
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
    setConsequence(null); setCompletionReason(null); setActivePlannedGoal(null);
    setAvailableBreakTime(null); setBreakEndTime(null); setCompletedSecretCode(null); setCompletedSecretCodeImage(null);
    setNextGoal(null); setBreakChoice(null);
  }, [currentUser]);

  const handleApiKeySubmit = (key) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setError(null);
  };
  
  const handleLogout = () => {
      resetToStart(true);
  };
  
  const handleCodeImageSubmit = useCallback(async (file) => {
    if (!currentUser) return;
    setIsLoading(true);
    setError(null);
    
    let tempSecretCodeImage = null;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    const imagePromise = new Promise(resolve => {
        reader.onload = () => {
            tempSecretCodeImage = reader.result;
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
        
        const activeState = { 
            secretCode: code, secretCodeImage: tempSecretCodeImage, goal, subject, 
            goalSetTime: goalStartTime, timeLimitInMs, consequence 
        };
        await dataService.saveActiveGoal(currentUser.uid, activeState);
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

  const handleGoalSuccess = useCallback(async (feedback, reason) => {
    if (!currentUser) return;
    setIsLoading(true);
    const endTime = Date.now();
    const duration = goalSetTime ? endTime - goalSetTime : 0;
    const finalGoal = getEffectiveGoal();

    try {
        const goalSummary = await summarizeGoal(finalGoal);
        const newEntry = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime, endTime, duration, completionReason: reason };
        await dataService.addHistoryItem(currentUser.uid, newEntry);
    } catch (e) { console.error("Failed to save goal:", e); }

    if (reason === 'verified' && secretCodeImage && streakData) {
        setCompletedSecretCode(secretCode);
        setCompletedSecretCodeImage(secretCodeImage);
        const newData = { ...streakData, lastCompletedCodeImage: secretCodeImage };
        setStreakData(newData);
        await dataService.saveStreakData(currentUser.uid, newData);
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

    if (reason === 'verified' && breakDurationMs > 0) {
        setAvailableBreakTime(breakDurationMs);
        setCompletionDuration(formatDuration(duration));
        setVerificationFeedback(feedback);
        setCompletionReason('verified');
        setAppState(AppState.AWAITING_BREAK);
        setIsLoading(false);
        return;
    }

    setCompletionDuration(formatDuration(duration));
    setCompletionReason(reason);
    setVerificationFeedback(feedback);
    setAppState(AppState.GOAL_COMPLETED);
    setIsLoading(false);
}, [currentUser, goalSetTime, getEffectiveGoal, secretCode, secretCodeImage, subject, activePlannedGoal, todaysPlan, streakData]);

  const handleProofImageSubmit = useCallback(async (files) => {
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
  
  const handleSendChatMessage = useCallback(async (message) => {
    if (!chat) return;
    setIsChatLoading(true); setError(null);
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);

    try {
        const response = await chat.sendMessage({ message });
        const jsonResponse = JSON.parse(response.text);
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
    if (!currentUser || !activeGoal || !streakData) return;
    const skipsLeft = 2 - (streakData.skipsThisWeek ?? 0);
    if (skipsLeft <= 0) {
        setError("You have no skips left for this week.");
        return;
    }
    if (!window.confirm(`Are you sure you want to skip this goal? This will use 1 of your ${skipsLeft} skips for the week.`)) {
        return;
    }
    setIsLoading(true); setError(null);
    const endTime = Date.now();
    const duration = goalSetTime ? endTime - goalSetTime : 0;
    try {
        const goalSummary = await summarizeGoal(goal);
        const newEntry = {
            id: endTime, goalSummary, fullGoal: goal, subject: subject,
            startTime: goalSetTime, endTime, duration, completionReason: 'skipped'
        };
        await dataService.addHistoryItem(currentUser.uid, newEntry);
        
        let breakDurationMs = 0;
        if (activePlannedGoal && todaysPlan) {
            const updatedGoals = todaysPlan.goals.map(g => g.id === activePlannedGoal.id ? { ...g, status: 'skipped' } : g);
            const updatedPlan = { ...todaysPlan, goals: updatedGoals };
            await dataService.savePlan(currentUser.uid, updatedPlan);
            breakDurationMs = calculateBreakFromSchedule(activePlannedGoal, updatedPlan.goals);
        }
        const updatedStreakData = {
            ...streakData,
            skipsThisWeek: (streakData.skipsThisWeek ?? 0) + 1,
            lastCompletedCodeImage: secretCodeImage || undefined,
        };
        await dataService.saveStreakData(currentUser.uid, updatedStreakData);
        setStreakData(updatedStreakData);
        await dataService.clearActiveGoal(currentUser.uid);
        
        if (breakDurationMs > 0) {
            setAvailableBreakTime(breakDurationMs);
            setCompletionDuration(formatDuration(duration));
            setCompletedSecretCode(secretCode);
            setCompletedSecretCodeImage(secretCodeImage);
            setVerificationFeedback(null);
            setCompletionReason('skipped');
            setAppState(AppState.AWAITING_BREAK);
        } else {
            setCompletionDuration(formatDuration(duration));
            setCompletionReason('skipped');
            setVerificationFeedback(null);
            setAppState(AppState.GOAL_COMPLETED);
        }
    } catch (err) {
        handleApiError(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, activeGoal, goalSetTime, goal, subject, handleApiError, activePlannedGoal, todaysPlan, streakData, secretCode, secretCodeImage]);

  const handleShowHistory = () => setAppState(AppState.HISTORY_VIEW);
  const handleHistoryBack = () => setAppState(AppState.TODAYS_PLAN);
  const handleDeleteHistoryItem = (firestoreDocId) => { if (currentUser) dataService.deleteHistoryItem(currentUser.uid, firestoreDocId); };
  const handleSetDailyCommitment = (text) => {
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

  const handleStartPlannedGoal = (goalToStart) => {
        if (!goalToStart.goal || goalToStart.goal.trim() === '') {
            setError("Please edit the goal to add a description before starting. It cannot be empty.");
            window.scrollTo(0, 0);
            return;
        }
        setError(null);
        setGoal(goalToStart.goal);
        setSubject(goalToStart.subject);
        setTimeLimitInMs(goalToStart.timeLimitInMs);
        setConsequence(goalToStart.consequence);
        setActivePlannedGoal(goalToStart);
        setAppState(AppState.AWAITING_CODE);
  };

  const handleEditGoal = (plan, goal) => {
    setEditingGoalInfo({ plan, goal });
  };
  const handleSaveEditedGoal = (payload) => {
    if (!editingGoalInfo || !currentUser) return;
    const { plan, goal } = editingGoalInfo;
    const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
    const updatedGoal = {
        ...goal,
        goal: payload.goal,
        subject: payload.subject,
        timeLimitInMs: totalMs > 0 ? totalMs : null,
        consequence: payload.consequence.trim() || null,
        startTime: payload.startTime,
        endTime: payload.endTime,
    };
    const updatedGoals = plan.goals.map(g => g.id === updatedGoal.id ? updatedGoal : g);
    const updatedPlan = { ...plan, goals: updatedGoals };

    if (plan.date === getISODateString(new Date())) {
        handleSavePlan(updatedPlan);
    } else {
        handleSavePlanAndUpdateWeek(updatedPlan);
    }
    setEditingGoalInfo(null);
  };
  const handleFinishDay = () => setAppState(AppState.GOAL_COMPLETED);
  const handleNextCodeImageSubmit = async (file) => {
        setIsLoading(true); setError(null);
        try {
            const base64 = await fileToBase64(file);
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const dataUrl = reader.result;
                extractCodeFromImage(base64, file.type).then(code => {
                    setNextGoal(prev => ({ ...prev, secretCode: code, secretCodeImage: dataUrl }));
                    setIsLoading(false);
                }).catch(err => { handleApiError(err); setIsLoading(false); });
            };
        } catch (err) { handleApiError(err); setIsLoading(false); }
  };
  const handleNextGoalSubmit = (payload) => {
        let totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        const newTimeLimitInMs = totalMs > 0 ? totalMs : null;
        setNextGoal({ 
            goal: payload.goal, subject: payload.subject, 
            timeLimitInMs: newTimeLimitInMs, consequence: payload.consequence 
        });
        if(availableBreakTime) setBreakEndTime(Date.now() + availableBreakTime);
        setAppState(AppState.BREAK_ACTIVE);
  };
  const handleSelectPlannedGoalForNext = (goalToSelect) => {
        setNextGoal({
            goal: goalToSelect.goal, subject: goalToSelect.subject, timeLimitInMs: goalToSelect.timeLimitInMs,
            consequence: goalToSelect.consequence, plannedGoalId: goalToSelect.id,
        });
        if(availableBreakTime) setBreakEndTime(Date.now() + availableBreakTime);
        setAppState(AppState.BREAK_ACTIVE);
  };
  const handleFinishBreakAndStartNextGoal = useCallback(async () => {
        if (!currentUser || !nextGoal?.goal || !nextGoal?.subject || !nextGoal?.secretCode || !nextGoal.secretCodeImage) {
            setError("Could not start next goal. Information was missing.");
            resetToStart();
            return;
        }
        const nextGoalTime = Date.now();
        const activeState = {
            secretCode: nextGoal.secretCode, secretCodeImage: nextGoal.secretCodeImage, 
            goal: nextGoal.goal, subject: nextGoal.subject, goalSetTime: nextGoalTime, 
            timeLimitInMs: nextGoal.timeLimitInMs || null, consequence: nextGoal.consequence || null,
        };
        await dataService.saveActiveGoal(currentUser.uid, activeState);
        
        if (nextGoal.plannedGoalId && todaysPlan) {
            const plannedGoal = todaysPlan.goals.find(g => g.id === nextGoal.plannedGoalId);
            setActivePlannedGoal(plannedGoal || null);
        } else { setActivePlannedGoal(null); }
        
        setBreakEndTime(null); setAvailableBreakTime(null); setNextGoal(null);
        setBreakChoice(null); setVerificationFeedback(null); setChat(null); setChatMessages([]);
  }, [nextGoal, currentUser, todaysPlan, resetToStart]);
  const handleAutoStartNextGoal = useCallback(async () => {
        if (!currentUser || !todaysPlan) return;
        const nextPendingGoal = todaysPlan.goals.filter(g => g.status === 'pending').sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
        if (!nextPendingGoal) { handleFinishDay(); return; }
        if (!completedSecretCode || !completedSecretCodeImage) {
            setError("Cannot auto-start next goal: previous code not found. Please start the next goal manually.");
            resetToStart(); return;
        }
        const nextGoalTime = Date.now();
        const activeState = {
            secretCode: completedSecretCode, secretCodeImage: completedSecretCodeImage,
            goal: nextPendingGoal.goal, subject: nextPendingGoal.subject,
            goalSetTime: nextGoalTime, timeLimitInMs: nextPendingGoal.timeLimitInMs,
            consequence: nextPendingGoal.consequence,
        };
        await dataService.saveActiveGoal(currentUser.uid, activeState);
        setActivePlannedGoal(nextPendingGoal);
        setBreakEndTime(null); setAvailableBreakTime(null); setNextGoal(null);
        setBreakChoice(null); setVerificationFeedback(null); setChat(null); setChatMessages([]);
  }, [currentUser, todaysPlan, completedSecretCode, completedSecretCodeImage, resetToStart]);
  const handleStartMealBreak = useCallback(() => {
        if (!todaysPlan || !completedSecretCode || !completedSecretCodeImage) {
            setError("Cannot start a meal break without a next planned goal or previous code."); return;
        }
        const nextPendingGoal = todaysPlan.goals.filter(g => g.status === 'pending').sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
        if (!nextPendingGoal) { setError("No more goals for today to start after a break."); return; }
        const FORTY_FIVE_MINS_MS = 45 * 60 * 1000;
        setNextGoal({
            goal: nextPendingGoal.goal, subject: nextPendingGoal.subject,
            timeLimitInMs: nextPendingGoal.timeLimitInMs, consequence: nextPendingGoal.consequence,
            plannedGoalId: nextPendingGoal.id,
        });
        setBreakEndTime(Date.now() + FORTY_FIVE_MINS_MS);
        setAppState(AppState.BREAK_ACTIVE);
  }, [todaysPlan, completedSecretCode, completedSecretCodeImage]);
  useEffect(() => {
        let intervalId;
        if (appState === AppState.AWAITING_BREAK) {
            setNextGoalSelectionCountdown(120000);
            intervalId = window.setInterval(() => {
                setNextGoalSelectionCountdown(prev => {
                    if (prev === null || prev <= 1000) {
                        clearInterval(intervalId);
                        handleAutoStartNextGoal();
                        return 0;
                    }
                    return prev - 1000;
                });
            }, 1000);
        } else if (nextGoalSelectionCountdown !== null) {
            setNextGoalSelectionCountdown(null);
        }
        return () => { if (intervalId) clearInterval(intervalId); };
  }, [appState, handleAutoStartNextGoal]);
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

    const handleNavigateWeek = async (direction) => {
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

  const renderContent = () => {
    if (isLoading) return React.createElement('div', { className: "flex justify-center items-center p-8" }, React.createElement(Spinner, null));
    if (!apiKey) return React.createElement(ApiKeyPrompt, { onSubmit: handleApiKeySubmit, error: error });
    if (!currentUser) return React.createElement(Auth, null);

    switch (appState) {
      case AppState.TODAYS_PLAN:
        return todaysPlan ? React.createElement(TodaysPlanComponent, { 
            initialPlan: todaysPlan, 
            onSavePlan: handleSavePlan, 
            onStartGoal: handleStartPlannedGoal, 
            onShowHistory: handleShowHistory,
            onShowWeeklyView: handleShowWeeklyView,
            onEditGoal: handleEditGoal
        }) : React.createElement('div', { className: "flex justify-center items-center p-8" }, React.createElement(Spinner, null));
      case AppState.WEEKLY_PLAN_VIEW:
          return weeklyPlans ? React.createElement(WeeklyPlanView, {
            initialPlans: weeklyPlans,
            weekStartDate: weekStartDate,
            onBack: () => setAppState(AppState.TODAYS_PLAN),
            onSavePlan: handleSavePlanAndUpdateWeek,
            onStartGoal: handleStartPlannedGoal,
            onNavigateWeek: handleNavigateWeek,
            isLoading: isLoading,
            onEditGoal: handleEditGoal
          }) : React.createElement('div', { className: "flex justify-center items-center p-8" }, React.createElement(Spinner, null));
      case AppState.AWAITING_CODE: return React.createElement(CodeUploader, { onCodeImageSubmit: handleCodeImageSubmit, isLoading: isLoading, onShowHistory: handleShowHistory, onLogout: handleLogout, currentUser: currentUser, streakData: streakData, onSetCommitment: handleSetDailyCommitment, onCompleteCommitment: handleCompleteDailyCommitment });
      case AppState.GOAL_SET: {
        const skipsLeft = 2 - (streakData?.skipsThisWeek ?? 0);
        return React.createElement(ProofUploader, { goal: goal, onProofImageSubmit: handleProofImageSubmit, isLoading: isLoading, goalSetTime: goalSetTime, timeLimitInMs: timeLimitInMs, consequence: consequence, onSkipGoal: handleSkipGoal, skipsLeftThisWeek: skipsLeft > 0 ? skipsLeft : 0, lastCompletedCodeImage: streakData?.lastCompletedCodeImage });
      }
      case AppState.HISTORY_VIEW: return React.createElement(GoalHistory, { onBack: handleHistoryBack, history: history, onDeleteHistoryItem: handleDeleteHistoryItem });
      case AppState.GOAL_COMPLETED: return React.createElement(VerificationResult, { isSuccess: true, secretCodeImage: secretCodeImage || completedSecretCodeImage, feedback: verificationFeedback, onRetry: handleRetry, onReset: () => resetToStart(false), completionDuration: completionDuration, completionReason: completionReason });
      
      case AppState.AWAITING_BREAK: {
            const isLastGoal = todaysPlan?.goals.length > 0 && todaysPlan.goals.every(g => g.status !== 'pending');
            if (isLastGoal) { return React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in" }, React.createElement('h2', { className: "text-3xl font-bold mb-4 text-green-400" }, "All Goals Completed!"), React.createElement('p', { className: "text-slate-300 mb-6" }, "Excellent work! You've finished everything for today. Your final unlock code is available."), React.createElement('button', { onClick: handleFinishDay, className: "w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300" }, "View Code & Finish Day")); }
            const uncompletedGoals = (todaysPlan?.goals.filter(g => g.status === 'pending') ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const now = new Date(); const hour = now.getHours(); const minute = now.getMinutes();
            const showLunchButton = (hour === 12 && minute >= 30) || hour === 13;
            const showDinnerButton = hour === 20;
            const mealBreakSection = (!breakChoice && (showLunchButton || showDinnerButton)) ? React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-6 rounded-lg shadow-2xl w-full text-center" }, React.createElement('h3', { className: "text-lg font-semibold text-slate-200 mb-3" }, "Or Take a Meal Break?"), React.createElement('div', { className: "flex flex-col sm:flex-row gap-4" }, showLunchButton && React.createElement('button', { onClick: handleStartMealBreak, className: "flex-1 bg-amber-600/50 border border-amber-500/50 text-amber-300 font-semibold py-3 px-4 rounded-lg hover:bg-amber-600/70 transition-colors" }, "Lunch Time (45 min)"), showDinnerButton && React.createElement('button', { onClick: handleStartMealBreak, className: "flex-1 bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 font-semibold py-3 px-4 rounded-lg hover:bg-indigo-600/70 transition-colors" }, "Dinner Time (45 min)"))) : null;
            let nextGoalContent;
            if (!breakChoice) {
                nextGoalContent = React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full text-center" }, React.createElement('h2', { className: "text-xl font-semibold mb-2 text-slate-200" }, "Prepare Your Next Goal"), React.createElement('p', { className: "text-slate-400 mb-4" }, "You have a break of ", React.createElement('span', { className: "text-cyan-300 font-bold" }, formatDuration(availableBreakTime ?? 0)), "."), React.createElement('div', { className: "flex flex-col sm:flex-row gap-4" }, React.createElement('button', { onClick: () => setBreakChoice('plan'), className: "flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors", disabled: uncompletedGoals.length === 0 }, "Choose from Plan ", uncompletedGoals.length === 0 && "(None Left)"), React.createElement('button', { onClick: () => setBreakChoice('new'), className: "flex-1 bg-slate-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors" }, "Set a New Goal")));
            } else if (breakChoice === 'new') {
                nextGoalContent = React.createElement(GoalSetter, { onGoalSubmit: handleNextGoalSubmit, isLoading: false, submitButtonText: "Confirm & Start Break", onCancel: () => setBreakChoice(null) });
            } else if (breakChoice === 'plan') {
                nextGoalContent = React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-6 rounded-lg shadow-2xl w-full text-center" }, React.createElement('h2', { className: "text-xl font-semibold mb-4 text-slate-200" }, "Select Next Goal from Plan"), React.createElement('div', { className: "space-y-3 max-h-64 overflow-y-auto pr-2" }, uncompletedGoals.map(g => React.createElement('div', { key: g.id, className: "p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-left flex items-center justify-between gap-4" }, React.createElement('div', null, React.createElement('p', { className: "font-mono text-sm text-cyan-300" }, `${g.startTime} - ${g.endTime}`), React.createElement('p', { className: "font-bold text-white mt-1" }, g.subject), React.createElement('p', { className: "text-xs text-slate-400" }, `${g.goal.substring(0, 70)}...`)), React.createElement('button', { onClick: () => handleSelectPlannedGoalForNext(g), className: "bg-cyan-500 text-slate-900 font-bold py-2 px-3 rounded-lg hover:bg-cyan-400 text-sm flex-shrink-0" }, "Select")))), React.createElement('button', { onClick: () => setBreakChoice(null), className: "mt-4 text-slate-400 hover:text-white text-sm" }, "Back"));
            } else { nextGoalContent = null; }

            return React.createElement('div', { className: "w-full max-w-2xl flex flex-col items-center gap-6" },
                React.createElement('div', { className: "w-full text-center bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700" },
                    React.createElement('p', { className: "text-sm text-slate-400 uppercase tracking-wider" }, "Prepare Next Goal In"),
                    React.createElement('p', { className: `text-3xl font-mono ${nextGoalSelectionCountdown !== null && nextGoalSelectionCountdown < 30000 ? 'text-red-400' : 'text-cyan-300'}` }, formatCountdown(nextGoalSelectionCountdown ?? 0))
                ),
                React.createElement('div', { className: "w-full max-w-lg flex flex-col justify-center gap-4" },
                    mealBreakSection,
                    nextGoalContent
                )
            );
        }
    
      case AppState.BREAK_ACTIVE: {
            const timeLeft = breakEndTime ? breakEndTime - currentTime : 0;
            const codeSubmitted = !!nextGoal?.secretCode;
            const codeUploader = codeSubmitted ? 
                React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full h-full flex flex-col justify-center items-center text-center" }, React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-16 w-16 text-green-400", viewBox: "0 0 20 20", fill: "currentColor" }, React.createElement('path', { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" })), React.createElement('h3', { className: "text-xl font-semibold text-green-400 mt-4" }, "Next Code Accepted!"), React.createElement('p', { className: "text-slate-300 mt-2" }, "Enjoy the rest of your break. The next goal will start automatically."), React.createElement('button', { onClick: handleFinishBreakAndStartNextGoal, className: "mt-6 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all" }, "Start Next Goal Now"))
                : React.createElement(CodeUploader, { onCodeImageSubmit: handleNextCodeImageSubmit, isLoading: isLoading, onShowHistory: () => {}, onLogout: () => {}, currentUser: null, streakData: null, onSetCommitment: () => {}, onCompleteCommitment: () => {} });

            return React.createElement('div', { className: "w-full max-w-2xl flex flex-col items-center gap-6" },
                React.createElement('div', { className: "w-full text-center bg-slate-800/80 backdrop-blur-sm p-3 rounded-lg border border-slate-700" }, React.createElement('p', { className: "text-sm text-slate-400 uppercase tracking-wider" }, "Break Ends In"), React.createElement('p', { className: `text-3xl font-mono ${timeLeft < 60000 ? 'text-red-400' : 'text-cyan-300'}` }, formatCountdown(timeLeft > 0 ? timeLeft : 0))),
                React.createElement('div', { className: "w-full flex flex-wrap justify-center items-start gap-6" },
                    completedSecretCodeImage && React.createElement('div', { className: "text-center flex-1 min-w-[280px]" }, React.createElement('p', { className: "text-slate-400 text-sm mb-2" }, "Unlocked Code:"), React.createElement('img', { src: completedSecretCodeImage, alt: "Sequestered code", className: "rounded-lg w-full border-2 border-green-500" })),
                    React.createElement('div', { className: "flex-1 min-w-[320px]" }, codeUploader)
                ),
                nextGoal?.goal && React.createElement('div', { className: "w-full max-w-lg bg-slate-800/50 border border-slate-700 p-4 rounded-lg shadow-2xl text-center" }, React.createElement('h3', { className: "text-md font-semibold text-slate-300 mb-1" }, "Up Next: ", React.createElement('span', { className: "font-bold text-white" }, nextGoal.subject)))
            );
        }

       default: return React.createElement('div', { className: "flex justify-center items-center p-8" }, React.createElement(Spinner, null));
    }
  };

  const editingModal = editingGoalInfo && React.createElement('div', { 
        className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 animate-fade-in overflow-y-auto",
        onClick: () => setEditingGoalInfo(null)
    },
    React.createElement('div', { className: "flex items-center justify-center min-h-full p-4" },
        React.createElement('div', { onClick: e => e.stopPropagation() },
            React.createElement(GoalSetter, { 
                initialData: editingGoalInfo.goal,
                onGoalSubmit: handleSaveEditedGoal,
                isLoading: false, 
                submitButtonText: "Save Changes",
                onCancel: () => setEditingGoalInfo(null)
            })
        )
    )
  );

  return React.createElement(
    'div', { className: "min-h-screen flex flex-col items-center justify-center p-4" },
    React.createElement('style', null, `@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`),
    React.createElement(Header, null),
    React.createElement('main', { className: "w-full flex flex-col items-center justify-center" },
        error && React.createElement(Alert, { message: error, type: "error" }),
        editingModal,
        appState === AppState.GOAL_SET && verificationFeedback && React.createElement('div', { className: "w-full max-w-lg mb-4 flex justify-center" },
            React.createElement(VerificationResult, { isSuccess: false, secretCodeImage: null, feedback: verificationFeedback, onRetry: handleRetry, onReset: () => resetToStart(false), chatMessages: chatMessages, onSendChatMessage: handleSendChatMessage, isChatLoading: isChatLoading })
        ),
        !(appState === AppState.GOAL_SET && verificationFeedback) && renderContent()
    )
  );
};

export default App;