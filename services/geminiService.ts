
import { GoogleGenAI, Type, Chat, Content } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
    if (ai) {
        const currentKey = localStorage.getItem('GEMINI_API_KEY');
        // Re-initialize if the key has changed (e.g., user logged out and in)
        // This is a bit of a simplification; a more robust solution might involve a dedicated setter function.
        if (ai.apiKey !== currentKey) {
            ai = null;
        } else {
            return ai;
        }
    }
    
    const apiKey = localStorage.getItem('GEMINI_API_KEY');
    if (!apiKey) {
        throw new Error("API Key not found in local storage. Please set it to use the application.");
    }

    ai = new GoogleGenAI({ apiKey });
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