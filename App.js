
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
import { formatDuration, getISODateString, getStartOfWeekISOString } from './utils/timeUtils.js';
import { defaultWeeklyPlan } from './utils/defaultSchedule.js';

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
import Spinner from './components/Spinner.js';
import ApiKeyPrompt from './components/ApiKeyPrompt.js';

const App = () => {
  const [appState, setAppState] = useState(AppState.TODAYS_PLAN);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeGoal, setActiveGoal] = useState(null);

  const [apiKey, setApiKey] = useState(null);
  const [isApiKeyValid, setIsApiKeyValid] = useState(false);
  const [secretCode, setSecretCode] = useState(null);
  const [secretCodeImage, setSecretCodeImage] = useState(null);
  const [goal, setGoal] = useState('');
  const [subject, setSubject] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  
  const [goalSetTime, setGoalSetTime] = useState(null);
  const [completionDuration, setCompletionDuration] = useState(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState(null);
  
  const [completionReason, setCompletionReason] = useState(null);
  const [activePlannedGoal, setActivePlannedGoal] = useState(null);
  const [skippedGoalForReflection, setSkippedGoalForReflection] = useState(null);

  const [completedSecretCodeImage, setCompletedSecretCodeImage] = useState(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [chat, setChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const [streakData, setStreakData] = useState(null);
  const [todaysPlan, setTodaysPlan] = useState(null);
  const [weekStartDate, setWeekStartDate] = useState(() => new Date(getStartOfWeekISOString(new Date())));
  const [weeklyPlans, setWeeklyPlans] = useState(null);
  const [editingGoalInfo, setEditingGoalInfo] = useState(null);
  const [showUnlockedCodeModal, setShowUnlockedCodeModal] = useState(false);

  
  useEffect(() => {
    const storedApiKey = localStorage.getItem('geminiApiKey');
    if (storedApiKey) {
        setApiKey(storedApiKey);
        setIsApiKeyValid(true); // Assume valid until an API call fails
    }
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
            setAppState(AppState.GOAL_SET);
        } else {
             setAppState(currentAppState => {
                // Prevent reverting to plan view if we are on the completion screen
                if (currentAppState !== AppState.GOAL_COMPLETED) {
                    return AppState.TODAYS_PLAN;
                }
                return currentAppState;
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

        const todaysDocument = await dataService.loadPlan(uid, today);
        if (!todaysDocument) {
            const dayIndex = (today.getDay() + 6) % 7;
            const defaultDayPlanData = defaultWeeklyPlan[dayIndex];
            const newPlan = {
                date: getISODateString(today),
                goals: defaultDayPlanData.goals.map(goal => ({
                    ...goal,
                    id: `${getISODateString(today)}-${Math.random()}`,
                    status: 'pending',
                    deadline: null,
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

  // This effect ensures that the activePlannedGoal state is correctly
  // restored from Firestore data (via activeGoal), making the app resilient to reloads.
  useEffect(() => {
    if (activeGoal && activeGoal.plannedGoalId && todaysPlan) {
        const foundGoal = todaysPlan.goals.find(g => g.id === activeGoal.plannedGoalId);
        if (foundGoal) {
            setActivePlannedGoal(foundGoal);
        } else {
            console.warn("Active goal's planned counterpart not found in today's plan.");
        }
    }
  }, [activeGoal, todaysPlan]);

  const handleSavePlan = useCallback((plan) => {
      if (!currentUser) return;
      if(plan.date === getISODateString(new Date())) {
        setTodaysPlan(plan);
      }
      dataService.savePlan(currentUser.uid, plan);
  }, [currentUser]);

  const handleSavePlanAndUpdateWeek = async (plan) => {
    if (!currentUser) return;
    await dataService.savePlan(currentUser.uid, plan);
    setWeeklyPlans(prevPlans => {
        if (!prevPlans) return [plan];
        const existingPlanIndex = prevPlans.findIndex(p => p.date === plan.date);
        if (existingPlanIndex > -1) {
            const updatedPlans = [...prevPlans];
            updatedPlans[existingPlanIndex] = plan;
            return updatedPlans;
        }
        return [...prevPlans, plan].sort((a, b) => a.date.localeCompare(b.date));
    });
  };
  
  const handleApiError = useCallback((err) => {
      const error = err;
      if (error.message.includes('API key not valid')) {
        setError('Your API key is not valid. Please enter a correct key.');
        setApiKey(null);
        setIsApiKeyValid(false);
        localStorage.removeItem('geminiApiKey');
      } else {
        setError(error.message);
      }
  }, []);

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
    setSkippedGoalForReflection(null);
    // completedSecretCodeImage is preserved to show the last unlocked code
  }, [currentUser]);

  const handleLogout = () => {
      resetToStart(true);
  };
  
  const handleCodeImageSubmit = useCallback(async (file) => {
    if (!currentUser || !apiKey) return;
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

        const code = await extractCodeFromImage(base64, file.type, apiKey);
        setSecretCode(code);
        
        const goalStartTime = Date.now();
        setGoalSetTime(goalStartTime);
        
        const activeState = { 
            secretCode: code, 
            secretCodeImage: tempSecretCodeImage, 
            goal, 
            subject, 
            goalSetTime: goalStartTime, 
            timeLimitInMs,
            plannedGoalId: activePlannedGoal?.id,
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
  }, [handleApiError, goal, subject, timeLimitInMs, currentUser, activePlannedGoal, apiKey]);

  const getEffectiveGoal = useCallback(() => {
    return goal;
  }, [goal]);

 const handleGoalSuccess = useCallback(async (feedback, reason) => {
    if (!currentUser || !apiKey) return;

    setIsLoading(true);
    const endTime = Date.now();
    const duration = goalSetTime ? endTime - goalSetTime : 0;
    const finalGoal = getEffectiveGoal();

    try {
        const goalSummary = await summarizeGoal(finalGoal, apiKey);
        const newEntry = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime, endTime, duration, completionReason: reason };
        await dataService.addHistoryItem(currentUser.uid, newEntry);
    } catch (e) { console.error("Failed to save goal:", e); }

    if (reason === 'verified' && secretCodeImage && streakData) {
        setCompletedSecretCodeImage(secretCodeImage);
        const newData = { ...streakData, lastCompletedCodeImage: secretCodeImage };
        setStreakData(newData); 
    }

    await dataService.clearActiveGoal(currentUser.uid);

    if (activePlannedGoal && todaysPlan) {
        const updatedGoals = todaysPlan.goals.map(g => g.id === activePlannedGoal.id ? { ...g, status: 'completed' } : g);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        await dataService.savePlan(currentUser.uid, updatedPlan);
        setActivePlannedGoal(null);
    }
    
    setCompletionDuration(formatDuration(duration));
    setCompletionReason(reason);
    setVerificationFeedback(feedback);
    setAppState(AppState.GOAL_COMPLETED);
    setIsLoading(false);
}, [currentUser, goal, goalSetTime, getEffectiveGoal, secretCode, secretCodeImage, subject, activePlannedGoal, todaysPlan, streakData, apiKey]);

  const handleProofImageSubmit = useCallback(async (files) => {
    if (!apiKey) return;
    const pauseStartTime = Date.now();
    setIsLoading(true); setError(null); setVerificationFeedback(null); setChat(null); setChatMessages([]);

    const resumeTimers = () => {
        const pausedMs = Date.now() - pauseStartTime;
        setGoalSetTime(prev => (prev ? prev + pausedMs : null));
    };

    try {
        const imagePayloads = await Promise.all(files.map(async (file) => ({ base64: await fileToBase64(file), mimeType: file.type })));
        const finalGoal = getEffectiveGoal();
        const result = await verifyGoalCompletion(finalGoal, imagePayloads, apiKey);

        if (result.completed) {
            await handleGoalSuccess(result.feedback, 'verified');
        } else {
            resumeTimers();
            setVerificationFeedback(result.feedback);
            const chatSession = createVerificationChat(finalGoal, imagePayloads, result, apiKey);
            setChat(chatSession);
            setChatMessages([{ role: 'model', text: result.feedback.summary }]);
            setIsLoading(false);
        }
    } catch (err) {
        resumeTimers();
        handleApiError(err);
        setIsLoading(false);
    }
  }, [getEffectiveGoal, handleApiError, handleGoalSuccess, apiKey]);
  
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
    const goalToSkip = todaysPlan?.goals.find(g => g.id === activeGoal?.plannedGoalId);

    if (!currentUser || !activeGoal || !streakData || !todaysPlan || !goalToSkip) {
        console.error("Could not skip goal. Required data is missing.", { 
            hasUser: !!currentUser, 
            hasActiveGoal: !!activeGoal, 
            hasStreak: !!streakData,
            hasPlan: !!todaysPlan,
            foundGoal: !!goalToSkip 
        });
        setError("An error occurred while trying to skip the goal. Please try again.");
        return;
    }

    setIsLoading(true); setError(null);
    try {
        const updatedStreakData = { ...streakData, skipsThisWeek: (streakData.skipsThisWeek ?? 0) + 1 };
        await dataService.saveStreakData(currentUser.uid, updatedStreakData);
        setStreakData(updatedStreakData);

        const updatedGoals = todaysPlan.goals.map(g => g.id === goalToSkip.id ? { ...g, status: 'skipped' } : g);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        await dataService.savePlan(currentUser.uid, updatedPlan);
        
        const reflectionGoalSetTime = Date.now();
        const reflectionActiveState = {
            secretCode: activeGoal.secretCode,
            secretCodeImage: activeGoal.secretCodeImage,
            goal: "Write a few sentences on why the previous goal was skipped and what can be done differently next time. Submit a screenshot of your notes as proof.",
            subject: "Accountability Reflection",
            goalSetTime: reflectionGoalSetTime,
            timeLimitInMs: 5 * 60 * 1000,
        };
        
        setSkippedGoalForReflection(goalToSkip);
        await dataService.saveActiveGoal(currentUser.uid, reflectionActiveState);

    } catch (err) {
        handleApiError(err);
    } finally {
        setIsLoading(false);
    }
}, [currentUser, activeGoal, streakData, todaysPlan, handleApiError]);

const handleAbandonGoal = useCallback(async () => {
    const goalToAbandonId = activeGoal?.plannedGoalId;

    if (!currentUser || !todaysPlan || !goalToAbandonId) {
        setError("Could not abandon goal. Required data is missing.");
        return;
    }

    setIsLoading(true);
    setError(null);

    try {
        const updatedGoals = todaysPlan.goals.filter(g => g.id !== goalToAbandonId);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        
        await dataService.savePlan(currentUser.uid, updatedPlan);
        
        resetToStart(); 

    } catch (err) {
        handleApiError(err);
        setIsLoading(false);
    }
}, [currentUser, activeGoal, todaysPlan, resetToStart, handleApiError]);

const handleDeadlineMissed = useCallback(() => {
    const goalToRemoveId = activeGoal?.plannedGoalId;

    if (!currentUser) {
        setInfoMessage("Deadline missed. The goal has been reset.");
        resetToStart();
        return;
    }

    // Also remove the goal from the plan for today
    if (todaysPlan && goalToRemoveId) {
        const updatedGoals = todaysPlan.goals.filter(g => g.id !== goalToRemoveId);
        const updatedPlan = { ...todaysPlan, goals: updatedGoals };
        handleSavePlan(updatedPlan);
    }
    
    setInfoMessage("Deadline missed. Your goal has been removed from today's plan, and the code is lost.");
    resetToStart();
}, [currentUser, activeGoal, todaysPlan, resetToStart, handleSavePlan]);


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

  const handleStartPlannedGoal = async (goalToStart) => {
    if (!currentUser) return;
    if (!goalToStart.goal || goalToStart.goal.trim() === '') {
        setError("Please edit the goal to add a description before starting. It cannot be empty.");
        window.scrollTo(0, 0);
        return;
    }
    if (!goalToStart.deadline) {
        setError("Please edit the goal to add a deadline before starting.");
        window.scrollTo(0, 0);
        return;
    }
    setError(null);

    const timeLimit = goalToStart.deadline - Date.now();
    
    setGoal(goalToStart.goal);
    setSubject(goalToStart.subject);
    setTimeLimitInMs(timeLimit > 0 ? timeLimit : 0);
    setActivePlannedGoal(goalToStart);
    setAppState(AppState.AWAITING_CODE);
};

  const handleEditGoal = (plan, goal) => {
    setEditingGoalInfo({ plan, goal });
  };
  const handleSaveEditedGoal = (payload) => {
    if (!editingGoalInfo || !currentUser) return;
    const { plan, goal } = editingGoalInfo;
    const updatedGoal = {
        ...goal,
        goal: payload.goal,
        subject: payload.subject,
        deadline: payload.deadline,
    };
    
    if (payload.pdfAttachment === null) {
      delete updatedGoal.pdfAttachment;
    } else if (payload.pdfAttachment !== undefined) {
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

    const handleApiKeySubmit = (submittedKey) => {
        localStorage.setItem('geminiApiKey', submittedKey);
        setApiKey(submittedKey);
        setIsApiKeyValid(true);
        setError(null);
    };

  const renderContent = () => {
    if (isLoading) return React.createElement('div', { className: "flex justify-center items-center p-8" }, React.createElement(Spinner, null));
    if (!isApiKeyValid) return React.createElement(ApiKeyPrompt, { onSubmit: handleApiKeySubmit, error: error });
    if (!currentUser) return React.createElement(Auth, null);

    switch (appState) {
      case AppState.TODAYS_PLAN:
        const viewCodeButton = completedSecretCodeImage && React.createElement('button', {
            onClick: () => setShowUnlockedCodeModal(true),
            className: "fixed bottom-4 right-4 bg-cyan-500 text-slate-900 font-bold py-3 px-5 rounded-full shadow-lg hover:bg-cyan-400 transition-all z-10 flex items-center gap-2 animate-fade-in button-glow-cyan"
        },
            React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", viewBox: "0 0 20 20", fill: "currentColor" }, React.createElement('path', { d: "M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2V7a5 5 0 00-5-5zm0 2a3 3 0 00-3 3v2h6V7a3 3 0 00-3-3z" })),
            "View Code"
        );

        const todaysPlanContent = todaysPlan ? React.createElement(TodaysPlanComponent, { 
            initialPlan: todaysPlan, 
            onSavePlan: handleSavePlan, 
            onStartGoal: handleStartPlannedGoal, 
            onShowHistory: handleShowHistory,
            onShowWeeklyView: handleShowWeeklyView,
            onEditGoal: handleEditGoal
        }) : React.createElement('div', { className: "flex justify-center items-center p-8" }, React.createElement(Spinner, null));
        
        return React.createElement(React.Fragment, null,
            todaysPlanContent,
            viewCodeButton
        );

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
        return React.createElement(ProofUploader, { goal: goal, subject: subject, onProofImageSubmit: handleProofImageSubmit, isLoading: isLoading, goalSetTime: goalSetTime, timeLimitInMs: timeLimitInMs, onSkipGoal: handleSkipGoal, onAbandonGoal: handleAbandonGoal, onDeadlineMissed: handleDeadlineMissed, skipsLeftThisWeek: skipsLeft > 0 ? skipsLeft : 0, lastCompletedCodeImage: streakData?.lastCompletedCodeImage, pdfAttachment: activeGoal?.pdfAttachment, apiKey: apiKey });
      }
      case AppState.HISTORY_VIEW: return React.createElement(GoalHistory, { onBack: handleHistoryBack, history: history, onDeleteHistoryItem: handleDeleteHistoryItem, apiKey: apiKey });
      case AppState.GOAL_COMPLETED: return React.createElement(VerificationResult, { isSuccess: true, secretCodeImage: secretCodeImage || completedSecretCodeImage, feedback: verificationFeedback, onRetry: handleRetry, onReset: () => resetToStart(false), completionDuration: completionDuration, completionReason: completionReason });
      
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
                planDate: editingGoalInfo.plan.date,
                onGoalSubmit: handleSaveEditedGoal,
                isLoading: false, 
                submitButtonText: "Save Changes",
                onCancel: () => setEditingGoalInfo(null)
            })
        )
    )
  );
  
  const unlockedCodeModal = showUnlockedCodeModal && completedSecretCodeImage && React.createElement('div', {
        className: "fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4",
        onClick: () => setShowUnlockedCodeModal(false)
    },
    React.createElement('div', { className: "relative", onClick: e => e.stopPropagation() },
        React.createElement('p', { className: "text-white text-center mb-2 font-semibold" }, "Your Unlocked Code"),
        React.createElement('img', {
            src: completedSecretCodeImage,
            alt: "Unlocked secret code",
            className: "rounded-lg max-h-[80vh] max-w-[90vw] object-contain"
        }),
        React.createElement('button', {
                onClick: () => setShowUnlockedCodeModal(false),
                className: "absolute -top-3 -right-3 bg-slate-800 text-white rounded-full p-1.5 leading-none hover:bg-slate-700 transition-colors",
                'aria-label': "Close image view"
            },
            React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: "2" },
                React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" })
            )
        )
    )
  );

  return React.createElement(
    'div', { className: "min-h-screen flex flex-col items-center justify-center p-4" },
    React.createElement(Header, null),
    React.createElement('main', { className: "w-full flex flex-col items-center justify-center" },
        error && !isApiKeyValid && React.createElement('div', null),
        error && isApiKeyValid && React.createElement(Alert, { message: error, type: "error" }),
        infoMessage && React.createElement(Alert, { message: infoMessage, type: "info" }),
        appState === AppState.GOAL_SET && verificationFeedback ? React.createElement('div', { className: "w-full max-w-lg mb-4 flex justify-center" },
            React.createElement(VerificationResult, { isSuccess: false, secretCodeImage: null, feedback: verificationFeedback, onRetry: handleRetry, onReset: () => resetToStart(false), chatMessages: chatMessages, onSendChatMessage: handleSendChatMessage, isChatLoading: isChatLoading })
        ) : (
          renderContent()
        )
    ),
    editingModal,
    unlockedCodeModal
  );
};

export default App;
