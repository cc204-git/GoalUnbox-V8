

import { GoogleGenAI, Type } from "@google/genai";

let ai = null;
let usedApiKey = null;

// FIX: Refactored to avoid accessing private 'apiKey' property and to correctly handle API key changes.
function getAiClient() {
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

const handleApiError = (error) => {
    console.error("Gemini API Error:", error);
    if (error instanceof Error) {
        if (error.message.includes('API key not valid') || error.message.includes('permission denied')) {
            return new Error("Your API Key is not valid. Please enter a valid key.");
        }
    }
    return new Error("An error occurred with the AI service. Please try again.");
};

export const extractCodeFromImage = async (base64Image, mimeType) => {
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

const verificationSystemInstruction = `You are a strict goal completion verifier...`;
const verificationSchema = {
    type: Type.OBJECT,
    properties: { completed: { type: Type.BOOLEAN }, feedback: { type: Type.OBJECT, properties: { summary: { type: Type.STRING }, approved_aspects: { type: Type.ARRAY, items: { type: Type.STRING } }, missing_aspects: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["summary", "approved_aspects", "missing_aspects"] } },
    required: ["completed", "feedback"],
};

export const verifyGoalCompletion = async (goal, images) => {
    try {
        const ai = getAiClient();
        const imageParts = images.map(image => ({ inlineData: { data: image.base64, mimeType: image.mimeType } }));
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: `The user's goal is: "${goal}". Here is my proof.` }, ...imageParts] },
            config: { systemInstruction: verificationSystemInstruction, responseMimeType: "application/json", responseSchema: verificationSchema }
        });
        return JSON.parse(response.text);
    } catch (error) {
        throw handleApiError(error);
    }
};

export const createVerificationChat = (goal, images, initialVerification) => {
    const ai = getAiClient();
    const imageParts = images.map(image => ({ inlineData: { data: image.base64, mimeType: image.mimeType } }));
    const initialUserContent = { role: 'user', parts: [{ text: `My goal is: "${goal}". Here is my proof.` }, ...imageParts] };
    const initialModelContent = { role: 'model', parts: [{ text: JSON.stringify(initialVerification) }] };
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        history: [initialUserContent, initialModelContent],
        config: { systemInstruction: verificationSystemInstruction, responseMimeType: "application/json", responseSchema: verificationSchema },
    });
};

export const summarizeGoal = async (goal) => {
    const prompt = `Summarize the following user goal into a concise phrase of 3 to 5 words, suitable for a table entry. Goal: "${goal}"`;
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing goal:", error);
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }
};

export const generateHistoryInsights = async (history) => {
    const prompt = `
        You are a productivity coach analyzing a user's goal history from the past week. Based on the following JSON data of their completed goals, provide a "Weekly Productivity Report" with actionable insights and encouraging feedback.
        Analyze their work patterns, subjects they focus on, goal completion times, and consistency.
        Identify their strengths (e.g., "You had great focus on 'Work' goals this week, especially in the morning").
        Point out potential areas for improvement (e.g., "It seems longer goals are a challenge. Have you considered breaking them down into smaller steps?").
        Keep the tone positive and motivational. Format the output as a concise, easy-to-read summary. Use markdown for formatting, like bullet points and bold text.

        Here is the user's goal history for the week:
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

export const extractScheduleFromImage = async (base64Image, mimeType, dayOfWeek) => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
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
        return result;
    }
    throw new Error("The AI returned an unexpected data format.");
  } catch (error) {
    throw handleApiError(error);
  }
};

const gatekeeperSchema = {
    type: Type.OBJECT,
    properties: {
        response_text: {
            type: Type.STRING,
            description: "Your conversational reply to the user."
        },
        allow_skip: {
            type: Type.BOOLEAN,
            description: "Set to true only if the user provides a valid, urgent reason."
        }
    },
    required: ["response_text", "allow_skip"]
};

const gatekeeperSystemInstruction = `You are a distraction gatekeeper, a firm but fair productivity coach. The user wants to skip their current goal. Your job is to challenge them and keep them on track.

1.  Start by asking for their reason for wanting to skip.
2.  Analyze their reason.
    -   If the reason is weak (e.g., "I'm bored," "I'm tired," "It's too hard"), offer encouragement. Suggest a 5-minute break, remind them of why they set the goal, or mention the consequence they set for themselves. DO NOT allow the skip.
    -   If the reason is a genuine emergency or an unavoidable, urgent interruption (e.g., "power outage," "family emergency," "unexpected important appointment"), be understanding and allow the skip.
3.  You MUST respond ONLY with a JSON object matching the provided schema.
4.  Set "allow_skip" to true ONLY for valid, urgent reasons. Otherwise, it MUST be false.
5.  Keep your responses concise and conversational.`;


export const createGatekeeperChat = (goal, consequence) => {
    const ai = getAiClient();
    const history = [
        {
            role: 'user',
            parts: [{ text: `My goal is: "${goal}". ${consequence ? `My consequence for failure is: "${consequence}".` : ''} I want to skip it.` }]
        },
        {
            role: 'model',
            parts: [{ text: JSON.stringify({ response_text: "I see. Before you do that, can you tell me why you need to skip this goal?", allow_skip: false }) }]
        }
    ];

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: {
            systemInstruction: gatekeeperSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: gatekeeperSchema
        },
    });
};