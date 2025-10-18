import React, { useState, useCallback } from 'react';
import { AppState } from './types';
import { extractCodeFromImage, verifyGoalCompletion, createVerificationChat, VerificationResult as VerificationResultType, VerificationFeedback } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { formatDuration } from './utils/timeUtils';
import Header from './components/Header';
import CodeUploader from './components/CodeUploader';
import GoalSetter, { GoalPayload } from './components/GoalSetter';
import ProofUploader from './components/ProofUploader';
import VerificationResult from './components/VerificationResult';
import Alert from './components/Alert';
import { Chat } from '@google/genai';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.AWAITING_CODE);
  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [secretCodeImage, setSecretCodeImage] = useState<string | null>(null);
  const [goal, setGoal] = useState<string>('');
  const [verificationFeedback, setVerificationFeedback] = useState<VerificationFeedback | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for timer
  const [goalSetTime, setGoalSetTime] = useState<number | null>(null);
  const [completionDuration, setCompletionDuration] = useState<string | null>(null);
  const [timeLimitInMs, setTimeLimitInMs] = useState<number | null>(null);
  const [consequence, setConsequence] = useState<string | null>(null);
  const [mustLeaveTime, setMustLeaveTime] = useState<number | null>(null);
  const [completionReason, setCompletionReason] = useState<'verified' | 'must-leave' | null>(null);


  // State for the new chat feature
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ text: string, role: 'user' | 'model' }>>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);


  const resetToStart = () => {
    setAppState(AppState.AWAITING_CODE);
    setSecretCode(null);
    setSecretCodeImage(null);
    setGoal('');
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
  };
  
  const handleCodeImageSubmit = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    // In-line promise to read file once for both dataUrl and base64
    const fileReaderPromise = new Promise<{dataUrl: string, base64: string}>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1];
                resolve({dataUrl, base64});
            } else {
                reject(new Error("Failed to read file as a data URL."));
            }
        };
        reader.onerror = (error) => reject(error);
    });

    try {
        const { dataUrl, base64 } = await fileReaderPromise;
        setSecretCodeImage(dataUrl); // Save the image data URL
        const code = await extractCodeFromImage(base64, file.type);
        setSecretCode(code);
        setAppState(AppState.AWAITING_GOAL);
    } catch (err) {
        setError((err as Error).message);
        setSecretCodeImage(null);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleGoalSubmit = useCallback((payload: GoalPayload) => {
    setGoal(payload.goal);
    setConsequence(payload.consequence);
    if (payload.timeLimit) {
        const totalMs = (payload.timeLimit.hours * 3600 + payload.timeLimit.minutes * 60) * 1000;
        setTimeLimitInMs(totalMs > 0 ? totalMs : null);
    } else {
        setTimeLimitInMs(null);
    }
    if (payload.mustLeaveTime) {
        const totalMs = (payload.mustLeaveTime.hours * 3600 + payload.mustLeaveTime.minutes * 60) * 1000;
        if (totalMs > 0) {
            setMustLeaveTime(Date.now() + totalMs);
        }
    } else {
        setMustLeaveTime(null);
    }
    setGoalSetTime(Date.now()); // Start timer
    setAppState(AppState.GOAL_SET);
  }, []);
  
  const getEffectiveGoal = useCallback(() => {
    if (timeLimitInMs && goalSetTime && consequence) {
      const deadline = goalSetTime + timeLimitInMs;
      if (Date.now() > deadline) {
        return `The user's original goal was: "${goal}". They failed to meet the time limit. The consequence is: "${consequence}". The new combined goal is to complete BOTH the original goal AND the consequence.`;
      }
    }
    return goal;
  }, [goal, timeLimitInMs, goalSetTime, consequence]);

  const handleMustLeaveTimeUp = useCallback(() => {
    setAppState(currentState => {
        if (currentState !== AppState.GOAL_SET) {
            return currentState; // Don't change state if not in GOAL_SET
        }
        
        setVerificationFeedback({
            summary: "Your 'Must Leave' time has been reached. Here is your code as requested.",
            approved_aspects: [],
            missing_aspects: ["Goal was not verified before the deadline."]
        });
        if (goalSetTime) {
            const duration = Date.now() - goalSetTime;
            setCompletionDuration(formatDuration(duration));
        }
        setCompletionReason('must-leave');
        return AppState.GOAL_COMPLETED;
    });
}, [goalSetTime]);


  const handleProofImageSubmit = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    setVerificationFeedback(null);
    setChat(null);
    setChatMessages([]);

    try {
        const imagePayloads = await Promise.all(
          files.map(async (file) => {
            const base64 = await fileToBase64(file);
            return { base64, mimeType: file.type };
          })
        );
        
        const finalGoal = getEffectiveGoal();

        const result: VerificationResultType = await verifyGoalCompletion(finalGoal, imagePayloads);
        setVerificationFeedback(result.feedback);

        if (result.completed) {
            if (goalSetTime) {
                const duration = Date.now() - goalSetTime;
                setCompletionDuration(formatDuration(duration));
            }
            setCompletionReason('verified');
            setAppState(AppState.GOAL_COMPLETED);
        } else {
            // Verification failed, so initialize the chat session
            const chatSession = createVerificationChat(finalGoal, imagePayloads, result);
            setChat(chatSession);
            setChatMessages([{ role: 'model', text: result.feedback.summary }]);
        }
    } catch (err) {
        setError((err as Error).message);
    } finally {
        setIsLoading(false);
    }
  }, [goal, goalSetTime, getEffectiveGoal]);
  
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
            if (goalSetTime) {
                const duration = Date.now() - goalSetTime;
                setCompletionDuration(formatDuration(duration));
            }
            setCompletionReason('verified');
            // Delay to let user read the final message before transitioning
            setTimeout(() => {
                setAppState(AppState.GOAL_COMPLETED);
            }, 1500);
        }

    } catch (err) {
        const errorMessage = "The verifier couldn't process your message. It might have responded in a non-standard format. Please try rephrasing.";
        setError(errorMessage);
        setChatMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
        setIsChatLoading(false);
    }
  }, [chat, goalSetTime]);


  const handleRetry = () => {
    setError(null);
    setVerificationFeedback(null);
    setChat(null);
    setChatMessages([]);
    setAppState(AppState.GOAL_SET);
  };

  const renderContent = () => {
    switch (appState) {
      case AppState.AWAITING_CODE:
        return <CodeUploader onCodeImageSubmit={handleCodeImageSubmit} isLoading={isLoading} />;
      case AppState.AWAITING_GOAL:
        return <GoalSetter onGoalSubmit={handleGoalSubmit} isLoading={isLoading} />;
      case AppState.GOAL_SET:
        return <ProofUploader 
                    goal={goal} 
                    onProofImageSubmit={handleProofImageSubmit} 
                    isLoading={isLoading} 
                    goalSetTime={goalSetTime}
                    timeLimitInMs={timeLimitInMs}
                    consequence={consequence}
                    mustLeaveTime={mustLeaveTime}
                    onMustLeaveTimeUp={handleMustLeaveTimeUp}
                />;
      case AppState.GOAL_COMPLETED:
        return <VerificationResult isSuccess={true} secretCodeImage={secretCodeImage} feedback={verificationFeedback} onRetry={handleRetry} onReset={resetToStart} completionDuration={completionDuration} completionReason={completionReason} />;
      default:
        return <CodeUploader onCodeImageSubmit={handleCodeImageSubmit} isLoading={isLoading} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900">
        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        `}</style>
      <Header />
      <main className="w-full flex flex-col items-center justify-center">
        {error && <Alert message={error} type="error" />}
        {appState === AppState.GOAL_SET && verificationFeedback && (
            <div className="w-full max-w-lg mb-4">
                 <VerificationResult 
                    isSuccess={false} 
                    secretCodeImage={null}
                    feedback={verificationFeedback} 
                    onRetry={handleRetry} 
                    onReset={resetToStart}
                    chatMessages={chatMessages}
                    onSendChatMessage={handleSendChatMessage}
                    isChatLoading={isChatLoading}
                 />
            </div>
        )}
        {/* Only show the main content uploader if there is no feedback to display */}
        {!(appState === AppState.GOAL_SET && verificationFeedback) && renderContent()}
      </main>
    </div>
  );
};

export default App;