

import React, { useState, useCallback, useEffect } from 'react';
import { AppState } from './types.js';
import { extractCodeFromImage, verifyGoalCompletion, createVerificationChat, summarizeGoal } from './services/geminiService.js';
import { getUserHistory, saveUserHistory, getStreakData, saveStreakData } from './services/authService.js';
import { saveActiveGoal, loadActiveGoal, clearActiveGoal } from './services/goalStateService.js';
import { fileToBase64 } from './utils/fileUtils.js';
import { formatDuration, getISODateString } from './utils/timeUtils.js';
import Header from './components/Header.js';
import CodeUploader from './components/CodeUploader.js';
import GoalSetter from './components/GoalSetter.js';
import ProofUploader from './components/ProofUploader.js';
import VerificationResult from './components/VerificationResult.js';
import Alert from './components/Alert.js';
import EmergencyTest from './components/EmergencyTest.js';
import GoalHistory from './components/GoalHistory.js';
import Auth from './components/Auth.js';
import ApiKeyPrompt from './components/ApiKeyPrompt.js';

const App = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY'));
  const [appState, setAppState] = useState(AppState.AUTH);
  const [currentUser, setCurrentUser] = useState(null);
  const [secretCode, setSecretCode] = useState(null);
  const [secretCodeImage, setSecretCodeImage] = useState(null);
  const [goal, setGoal] = useState('');
  const [subject, setSubject] = useState('');
  const [verificationFeedback, setVerificationFeedback] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [goalSetTime, setGoalSetTime] = useState(null);
  const [completionDuration, setCompletionDuration] = useState(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState(null);
  const [consequence, setConsequence] = useState(null);
  const [mustLeaveTime, setMustLeaveTime] = useState(null);
  
  const [completionReason, setCompletionReason] = useState(null);
  const [completionTrigger, setCompletionTrigger] = useState({ reason: null });

  const [chat, setChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [streakData, setStreakData] = useState(null);
  
  const handleLoginCallback = useCallback((email, rememberMe, isAutoLogin = false) => {
      if (rememberMe && !isAutoLogin) {
          localStorage.setItem('goalUnboxRememberedUser', email);
      } else if (!rememberMe) {
          localStorage.removeItem('goalUnboxRememberedUser');
      }
      setCurrentUser(email);
      checkAndInitializeStreak(email);
      restoreSession(email);
  }, []);
  
  useEffect(() => {
      if (apiKey) {
          const rememberedUser = localStorage.getItem('goalUnboxRememberedUser');
          if (rememberedUser) {
              handleLoginCallback(rememberedUser, true, true); // auto-login
          } else {
              setAppState(AppState.AUTH);
          }
      }
  }, [apiKey, handleLoginCallback]);

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

  const resetToStart = (isLogout = false) => {
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
    setMustLeaveTime(null);
    setCompletionReason(null);
    setCompletionTrigger({ reason: null });
  };
  
  const restoreSession = (email) => {
      const savedState = loadActiveGoal(email);
      if (savedState) {
          setSecretCode(savedState.secretCode);
          setSecretCodeImage(savedState.secretCodeImage);
          setGoal(savedState.goal);
          setSubject(savedState.subject);
          setGoalSetTime(savedState.goalSetTime);
          setTimeLimitInMs(savedState.timeLimitInMs);
          setConsequence(savedState.consequence);
          setMustLeaveTime(savedState.mustLeaveTime);
          setAppState(AppState.GOAL_SET);
      } else {
          setAppState(AppState.AWAITING_CODE);
      }
  };

  const checkAndInitializeStreak = (email) => {
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


  const handleApiKeySubmit = (key) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setError(null);
  };
  
  const handleLogin = (email, rememberMe) => {
    handleLoginCallback(email, rememberMe, false);
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

  const handleCodeImageSubmit = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    
    try {
        const base64 = await fileToBase64(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => setSecretCodeImage(reader.result);

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

  const handleGoalSubmit = useCallback((payload) => {
    const goalStartTime = Date.now();
    let totalMs = payload.timeLimit ? (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000 : 0;
    const newTimeLimitInMs = totalMs > 0 ? totalMs : null;
    let newMustLeaveTime = null;
    if (payload.mustLeaveTime) {
        const mustLeaveMs = (payload.mustLeaveTime.hours * 3600 + payload.mustLeaveTime.minutes * 60) * 1000;
        if (mustLeaveMs > 0) newMustLeaveTime = goalStartTime + mustLeaveMs;
    }
    setGoal(payload.goal);
    setSubject(payload.subject);
    setConsequence(payload.consequence);
    setTimeLimitInMs(newTimeLimitInMs);
    setMustLeaveTime(newMustLeaveTime);
    setGoalSetTime(goalStartTime);
    setAppState(AppState.GOAL_SET);

    if (secretCode && secretCodeImage) {
        const activeState = { secretCode, secretCodeImage, goal: payload.goal, subject: payload.subject, goalSetTime: goalStartTime, timeLimitInMs: newTimeLimitInMs, consequence: payload.consequence, mustLeaveTime: newMustLeaveTime };
        saveActiveGoal(currentUser, activeState);
    }
  }, [secretCode, secretCodeImage, currentUser]);
  
  const getEffectiveGoal = useCallback(() => {
    if (timeLimitInMs && goalSetTime && consequence && Date.now() > goalSetTime + timeLimitInMs) {
      return `The user's original goal was: "${goal}". They failed to meet the time limit. The consequence is: "${consequence}". The new combined goal is to complete BOTH the original goal AND the consequence.`;
    }
    return goal;
  }, [goal, timeLimitInMs, goalSetTime, consequence]);

  const handleMustLeaveTimeUp = useCallback(() => {
    if (appState === AppState.GOAL_SET) setCompletionTrigger({ reason: 'must-leave' });
  }, [appState]);

  const handleProofImageSubmit = useCallback(async (files) => {
    const pauseStartTime = Date.now();
    setIsLoading(true);
    setError(null);
    setVerificationFeedback(null);
    setChat(null);
    setChatMessages([]);

    const resumeTimers = () => {
        const pausedMs = Date.now() - pauseStartTime;
        setGoalSetTime(prev => (prev ? prev + pausedMs : null));
        setMustLeaveTime(prev => (prev ? prev + pausedMs : null));
    };

    try {
        const imagePayloads = await Promise.all(files.map(async (file) => ({ base64: await fileToBase64(file), mimeType: file.type })));
        const finalGoal = getEffectiveGoal();
        const result = await verifyGoalCompletion(finalGoal, imagePayloads);

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
  
  const handleSendChatMessage = useCallback(async (message) => {
    if (!chat) return;
    setIsChatLoading(true);
    setError(null);
    setChatMessages(prev => [...prev, { role: 'user', text: message }]);

    try {
        const response = await chat.sendMessage(message);
        const jsonResponse = JSON.parse(response.text);
        const newResult = jsonResponse;
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
          if (reason === 'must-leave') setVerificationFeedback({ summary: "Your 'Must Leave' time has been reached.", approved_aspects: [], missing_aspects: ["Goal not verified before deadline."] });
          else if (reason === 'emergency') setVerificationFeedback(null);
          
          try {
              const goalSummary = await summarizeGoal(finalGoal);
              const newEntry = { id: endTime, goalSummary, fullGoal: finalGoal, subject: subject, startTime: goalSetTime, endTime, duration, completionReason: reason };
              const historyKey = currentUser ? null : 'goalUnboxHistory';
              const history = currentUser ? getUserHistory(currentUser) : JSON.parse(localStorage.getItem(historyKey) || '[]');
              history.push(newEntry);
              if (currentUser) saveUserHistory(currentUser, history);
              else localStorage.setItem(historyKey, JSON.stringify(history));
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

  const handleDeleteHistoryItem = (idToDelete) => {
    const updatedHistory = history.filter(item => item.id !== idToDelete);
    setHistory(updatedHistory);
    if (currentUser) {
        saveUserHistory(currentUser, updatedHistory);
    } else {
        localStorage.setItem('goalUnboxHistory', JSON.stringify(updatedHistory));
    }
  };

  const handleSetDailyCommitment = (text) => {
      if (!currentUser || !streakData) return;
      const todayStr = getISODateString(new Date());
      const newCommitment = { date: todayStr, text, completed: false };
      const newData = { ...streakData, commitment: newCommitment };
      setStreakData(newData);
      saveStreakData(currentUser, newData);
  };
    
  const handleCompleteDailyCommitment = () => {
      if (!currentUser || !streakData || !streakData.commitment || streakData.commitment.completed) return;
      
      const todayStr = getISODateString(new Date());
      const newCommitment = { ...streakData.commitment, completed: true };
      const newStreak = streakData.lastCompletionDate === todayStr ? streakData.currentStreak : streakData.currentStreak + 1;
      
      const newData = {
          ...streakData,
          commitment: newCommitment,
          currentStreak: newStreak,
          lastCompletionDate: todayStr,
      };
      
      setStreakData(newData);
      saveStreakData(currentUser, newData);
  };

  const renderContent = () => {
    if (!apiKey) return React.createElement(ApiKeyPrompt, { onSubmit: handleApiKeySubmit, error: error });

    switch (appState) {
      case AppState.AUTH: return React.createElement(Auth, { onLogin: handleLogin, onContinueAsGuest: handleContinueAsGuest });
      case AppState.AWAITING_CODE: return React.createElement(CodeUploader, { onCodeImageSubmit: handleCodeImageSubmit, isLoading: isLoading, onShowHistory: handleShowHistory, onLogout: handleLogout, currentUser: currentUser, streakData: streakData, onSetCommitment: handleSetDailyCommitment, onCompleteCommitment: handleCompleteDailyCommitment });
      case AppState.AWAITING_GOAL: return React.createElement(GoalSetter, { onGoalSubmit: handleGoalSubmit, isLoading: isLoading });
      case AppState.GOAL_SET: return React.createElement(ProofUploader, { goal: goal, onProofImageSubmit: handleProofImageSubmit, isLoading: isLoading, goalSetTime: goalSetTime, timeLimitInMs: timeLimitInMs, consequence: consequence, mustLeaveTime: mustLeaveTime, onMustLeaveTimeUp: handleMustLeaveTimeUp, onStartEmergency: handleStartEmergency });
      case AppState.EMERGENCY_TEST: return React.createElement(EmergencyTest, { onSuccess: handleEmergencySuccess, onCancel: handleEmergencyCancel });
      case AppState.HISTORY_VIEW:
        return React.createElement(GoalHistory, { 
            onBack: () => { setHistory([]); restoreSession(currentUser); }, 
            history: history, 
            onDeleteHistoryItem: handleDeleteHistoryItem 
        });
      case AppState.GOAL_COMPLETED: return React.createElement(VerificationResult, { isSuccess: true, secretCodeImage: secretCodeImage, feedback: verificationFeedback, onRetry: handleRetry, onReset: () => resetToStart(false), completionDuration: completionDuration, completionReason: completionReason });
      default: return React.createElement(Auth, { onLogin: handleLogin, onContinueAsGuest: handleContinueAsGuest });
    }
  };

  return React.createElement(
    'div', { className: 'min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900' },
    React.createElement('style', {}, `@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`),
    React.createElement(Header, null),
    React.createElement(
      'main', { className: 'w-full flex flex-col items-center justify-center' },
      error && appState !== AppState.AUTH && !apiKey && React.createElement('div', null),
      error && (appState !== AppState.AUTH && apiKey) && React.createElement(Alert, { message: error, type: 'error' }),
      appState === AppState.GOAL_SET && verificationFeedback && !completionTrigger.reason && React.createElement(
        'div', { className: 'w-full max-w-lg mb-4' },
        React.createElement(VerificationResult, { isSuccess: false, secretCodeImage: null, feedback: verificationFeedback, onRetry: handleRetry, onReset: () => resetToStart(false), chatMessages: chatMessages, onSendChatMessage: handleSendChatMessage, isChatLoading: isChatLoading })
      ),
      !(appState === AppState.GOAL_SET && verificationFeedback && !completionTrigger.reason) && renderContent()
    )
  );
};

export default App;
