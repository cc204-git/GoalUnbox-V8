
import React, { useState } from 'react';
import { VerificationFeedback } from '../services/geminiService';
import ChatBox from './ChatBox';

interface VerificationResultProps {
  isSuccess: boolean;
  secretCodeImage: string | null;
  feedback: VerificationFeedback | null;
  onRetry: () => void;
  onReset: () => void;
  chatMessages?: { text: string; role: 'user' | 'model' }[];
  onSendChatMessage?: (message: string) => void;
  isChatLoading?: boolean;
  completionDuration?: string | null;
  completionReason?: 'verified' | 'emergency' | null;
}

const FeedbackSection: React.FC<{title: string; items: string[]; color: 'green' | 'red'}> = ({ title, items, color }) => {
    if (!items || items.length === 0) return null;
    const colorClasses = {
        green: 'text-green-300 border-green-500/30',
        red: 'text-red-300 border-red-500/30',
    };
    return (
        <div className="text-left mb-4">
            <h4 className={`font-semibold text-lg mb-2 ${color === 'green' ? 'text-green-400' : 'text-red-400'}`}>{title}</h4>
            <ul className={`list-disc list-inside space-y-1 pl-2 border-l-2 ${colorClasses[color]}`}>
                {items.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
        </div>
    );
};

const VerificationResult: React.FC<VerificationResultProps> = ({ isSuccess, secretCodeImage, feedback, onRetry, onReset, chatMessages, onSendChatMessage, isChatLoading, completionDuration, completionReason }) => {
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  if (isSuccess) {
    const title = completionReason === 'emergency' ? "Emergency Access" : "Goal Completed!";
    const titleColor = completionReason === 'emergency' ? 'text-red-400' : 'text-green-400';
    const successMessage = completionReason === 'emergency'
        ? "You passed the test. Your code is now available."
        : "Congratulations on achieving your goal!";

    return (
      <>
        <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in">
          <h2 className={`text-3xl font-bold mb-4 ${titleColor}`}>{title}</h2>
          <p className="text-slate-300 mb-6">{feedback?.summary || successMessage}</p>
          
          {feedback && feedback.approved_aspects.length > 0 && <FeedbackSection title="Approved Aspects" items={feedback.approved_aspects} color="green" />}
          {feedback && feedback.missing_aspects.length > 0 && <FeedbackSection title="Missing Aspects" items={feedback.missing_aspects} color="red" />}
          
          {completionDuration && (
            <div className="my-4 text-center">
              <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Time Taken
              </p>
              <p className="text-xl font-semibold text-white mt-1">{completionDuration}</p>
            </div>
          )}

          {secretCodeImage && (
            <div className="mt-6">
              <p className="text-slate-400 text-sm mb-2">Your unlock code is revealed:</p>
              <button onClick={() => setIsImageModalOpen(true)} className="cursor-zoom-in group" aria-label="View larger image">
                <img 
                  src={secretCodeImage} 
                  alt="Sequestered code" 
                  className="rounded-lg max-w-xs mx-auto border-2 border-green-500 group-hover:border-cyan-400 transition-colors" 
                />
              </button>
            </div>
          )}

          <button
            onClick={onReset}
            className="mt-8 w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300"
          >
            Start a New Goal
          </button>
          <p className="text-xs text-slate-500 mt-4 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Your achievement has been saved to your goal history.
          </p>
        </div>
        
        {isImageModalOpen && secretCodeImage && (
          <div 
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div className="relative" onClick={(e) => e.stopPropagation()}>
                <img
                  src={secretCodeImage}
                  alt="Sequestered code, enlarged view"
                  className="rounded-lg max-h-[90vh] max-w-[90vw] object-contain"
                />
                <button
                    onClick={() => setIsImageModalOpen(false)}
                    className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1.5 leading-none hover:bg-slate-700 transition-colors"
                    aria-label="Close image view"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-lg text-center animate-fade-in">
      <h2 className="text-2xl font-semibold mb-4 text-red-400">Verification Failed</h2>
      
      {feedback && (
        <div className="bg-slate-900/50 p-6 rounded-lg my-6 border border-slate-700">
            <p className="text-slate-300 mb-6 italic">"{feedback.summary}"</p>
            <FeedbackSection title="What's Missing" items={feedback.missing_aspects} color="red" />
            <FeedbackSection title="What's Approved" items={feedback.approved_aspects} color="green" />
        </div>
      )}

      {chatMessages && onSendChatMessage && (
        <div className="mb-6">
            <ChatBox
                messages={chatMessages}
                onSendMessage={onSendChatMessage}
                isLoading={isChatLoading ?? false}
            />
        </div>
      )}

      <p className="text-slate-400 mb-6">Address the feedback, chat with the verifier, or submit new proof.</p>
      
      <button
        onClick={onRetry}
        className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 transition-all duration-300"
      >
        Submit New Proof
      </button>
    </div>
  );
};

export default VerificationResult;