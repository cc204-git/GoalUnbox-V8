
import { GoogleGenAI, Type, Chat, Content } from "@google/genai";
import { CompletedGoal } from "../types";

let ai: GoogleGenAI | null = null;
let usedApiKey: string | null = null;

// FIX: Refactored to avoid accessing private 'apiKey' property and to correctly handle API key changes.
function getAiClient(): GoogleGenAI {
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    if (!apiKey) {
        throw new Error("API Key not found in local storage. Please set it to use the application.");
    }

    // If 'ai' instance exists and was created with the current apiKey, return it.
    if (ai && usedApiKey === apiKey) {
        return ai;
    }

    // Otherwise, create a new instance.
    ai = new GoogleGenAI({ apiKey });
    usedApiKey = apiKey;
    return ai;
}

const handleApiError = (error: unknown): Error => {
    console.error("Gemini API Error:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid') || error.message.includes('permission denied')) {
            return new Error("Your API Key is not valid. Please enter a valid key.");
        }
    }
    return new Error("An error occurred with the AI service. Please try again.");
};

export const extractCodeFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: "Analyze this image and extract the 3-digit number. Respond with only the three digits. If no 3-digit number is clearly visible, respond with 'ERROR'."
          },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
    });

    const code = response.text.trim();
    if (/^\d{3}$/.test(code)) {
      return code;
    } else {
      throw new Error("Could not find a valid 3-digit code in the image. Please try again with a clearer picture.");
    }
  } catch (error) {
    throw handleApiError(error);
  }
};

export interface VerificationFeedback {
  summary: string;
  approved_aspects: string[];
  missing_aspects: string[];
}

export interface VerificationResult {
  completed: boolean;
  feedback: VerificationFeedback;
}

const verificationSystemInstruction = `You are a strict goal completion verifier. The user's goal is provided. The user has submitted images as proof. Analyze the images and conversation to determine if the goal has been fully met. Be critical. Respond ONLY with a JSON object matching the provided schema. In the feedback, provide a summary, list the specific parts of the goal that were approved based on the images, and the specific parts that are still missing or not proven. If the user convinces you the goal is complete, set "completed" to true.`;

const verificationSchema = {
    type: Type.OBJECT,
    properties: {
        completed: { type: Type.BOOLEAN, description: "True if the goal is verifiably completed based on the image, otherwise false." },
        feedback: {
            type: Type.OBJECT,
            description: "Detailed feedback on goal completion.",
            properties: {
                summary: { type: Type.STRING, description: "A one-sentence summary of the verification result." },
                approved_aspects: { type: Type.ARRAY, items: { type: Type.STRING } },
                missing_aspects: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "approved_aspects", "missing_aspects"]
        },
    },
    required: ["completed", "feedback"],
};

export const verifyGoalCompletion = async (goal: string, images: { base64: string, mimeType: string }[]): Promise<VerificationResult> => {
    try {
        const ai = getAiClient();
        const imageParts = images.map(image => ({ inlineData: { data: image.base64, mimeType: image.mimeType } }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `The user's goal is: "${goal}". Here is my proof.` }, ...imageParts] },
            config: {
                systemInstruction: verificationSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: verificationSchema,
            }
        });
        
        return JSON.parse(response.text) as VerificationResult;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const createVerificationChat = (goal: string, images: { base64: string, mimeType: string }[], initialVerification: VerificationResult): Chat => {
    const ai = getAiClient();
    const imageParts = images.map(image => ({ inlineData: { data: image.base64, mimeType: image.mimeType } }));
    const initialUserContent: Content = { role: 'user', parts: [{ text: `My goal is: "${goal}". Here is my proof.` }, ...imageParts] };
    const initialModelContent: Content = { role: 'model', parts: [{ text: JSON.stringify(initialVerification) }] };

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        history: [initialUserContent, initialModelContent],
        config: { systemInstruction: verificationSystemInstruction, responseMimeType: "application/json", responseSchema: verificationSchema },
    });
};

// --- Emergency Test Feature ---
// Interfaces and Schemas remain the same
export interface FrenchTestQuestion { question: string; options: string[]; answer: string; }
export interface FrenchTestData { paragraphB2: string; paragraphC1: string; questions: FrenchTestQuestion[]; }
export interface TestCorrection { questionNumber: number; userAnswer: string; correctAnswer: string; explanation: string; }
export interface GradingResult { scorePercentage: number; passed: boolean; corrections: TestCorrection[]; }

const frenchTestSchema = { /* ... schema ... */ };
const gradingSchema = { /* ... schema ... */ };

export const generateFrenchTest = async (level: 'B2' | 'C1'): Promise<FrenchTestData> => {
    const prompt = `You are a French language teaching assistant...`; // prompt is long, keeping it collapsed
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: frenchTestSchema }
        });
        return JSON.parse(response.text) as FrenchTestData;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const gradeFrenchTest = async (questions: FrenchTestQuestion[], userAnswers: { [key: number]: string }): Promise<GradingResult> => {
    const prompt = `You are an expert French language examiner...`; // prompt is long, keeping it collapsed
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: gradingSchema }
        });
        return JSON.parse(response.text) as GradingResult;
    } catch (error) {
        throw handleApiError(error);
    }
};

export const summarizeGoal = async (goal: string): Promise<string> => {
    const prompt = `Summarize the following user goal into a concise phrase of 3 to 5 words, suitable for a table entry. Goal: "${goal}"`;
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch (error) {
        // Fallback to simple truncation, no need to throw API key error here
        console.error("Error summarizing goal:", error);
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }
};

export const generateHistoryInsights = async (history: CompletedGoal[]): Promise<string> => {
    const prompt = `
        You are a productivity coach analyzing a user's goal history. Based on the following JSON data of their completed goals, provide actionable insights and encouraging feedback.
        Analyze their work patterns, subjects they focus on, goal completion times, and consistency.
        Identify their strengths (e.g., "You're great at focusing on 'Work' goals in the morning").
        Point out potential areas for improvement (e.g., "It seems you struggle with longer goals. Maybe try breaking them down?").
        Keep the tone positive and motivational. Format the output as a concise, easy-to-read summary. Use markdown for formatting, like bullet points.

        Here is the user's goal history:
        ${JSON.stringify(history, null, 2)}
    `;
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch (error) {
        throw handleApiError(error);
    }
};

export interface ExtractedEvent {
    subject: string;
    startTime: string; // "HH:mm"
    endTime: string; // "HH:mm"
}

const scheduleExtractionSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            subject: {
                type: Type.STRING,
                description: "The full subject or title of the event (e.g., 'Self-Study: Physique')."
            },
            startTime: {
                type: Type.STRING,
                description: "The start time of the event in HH:mm format."
            },
            endTime: {
                type: Type.STRING,
                description: "The end time of the event in HH:mm format."
            },
        },
        required: ["subject", "startTime", "endTime"],
    },
};

export const extractScheduleFromImage = async (base64Image: string, mimeType: string, dayOfWeek: string): Promise<ExtractedEvent[]> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro', // Using a more powerful model for complex image parsing
      contents: {
        parts: [
          {
            text: `Analyze the provided image, which is a weekly schedule. Extract all scheduled events ONLY for ${dayOfWeek}. The days of the week (Mon, Tue, etc.) are at the top. The times are on the left vertical axis. For each event on the specified day, extract its subject/title, start time, and end time. Respond with a JSON array matching the provided schema. If there are no events for that day, return an empty array.`
          },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: scheduleExtractionSchema,
      }
    });

    const result = JSON.parse(response.text);
    if (Array.isArray(result)) {
        return result as ExtractedEvent[];
    }
    throw new Error("The AI returned an unexpected data format.");
  } catch (error) {
    throw handleApiError(error);
  }
};
