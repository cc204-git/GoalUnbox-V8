
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
// FIX: Add missing French test generation and grading functions.
const frenchTestSchema = {
    type: Type.OBJECT,
    properties: {
        paragraphB2: { type: Type.STRING, description: "A French paragraph of 4-5 sentences at a B2 CEFR level on a topic of general interest." },
        paragraphC1: { type: Type.STRING, description: "An improved, more nuanced version of the B2 paragraph, elevated to a C1 CEFR level with more complex vocabulary and sentence structures." },
        questions: {
            type: Type.ARRAY,
            description: "An array of 20 multiple-choice questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING, description: "The question text in French." },
                    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "An array of 4 possible answers (A, B, C, D)." },
                    answer: { type: Type.STRING, description: "The letter of the correct option (e.g., 'A')." }
                },
                required: ["question", "options", "answer"]
            }
        }
    },
    required: ["paragraphB2", "paragraphC1", "questions"]
};

export const generateFrenchTest = async (level) => {
    const prompt = `
        Generate a French language test for a user at the ${level} CEFR level. The test must follow this structure:
        1.  A short paragraph (4-5 sentences) in French at a B2 level on a topic like technology, environment, or culture.
        2.  An "improved" version of the same paragraph, elevated to a C1 level with more sophisticated vocabulary and complex grammar.
        3.  A total of 20 multiple-choice questions in French, with 4 options each (A, B, C, D).
            - The first 10 questions should be based on the provided paragraphs (testing reading comprehension, vocabulary, and grammar from the texts).
            - The next 10 questions should be general knowledge French questions appropriate for the ${level} level, covering grammar, idioms, and cultural nuances.
        
        Ensure all questions have exactly 4 options and a single correct answer specified by its letter.
        Return the entire test as a single JSON object matching the provided schema.
    `;
    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: frenchTestSchema,
            }
        });

        const result = JSON.parse(response.text);
        if (!result.questions || result.questions.length !== 20 || !result.paragraphB2 || !result.paragraphC1) {
            throw new Error("AI returned an incomplete or invalid test structure.");
        }
        return result;
    } catch (error) {
        console.error("Error generating French test:", error);
        throw handleApiError(error);
    }
};

const gradingSchema = {
    type: Type.OBJECT,
    properties: {
        passed: { type: Type.BOOLEAN },
        scorePercentage: { type: Type.NUMBER },
        corrections: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    questionNumber: { type: Type.NUMBER },
                    userAnswer: { type: Type.STRING },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                },
                required: ["questionNumber", "userAnswer", "correctAnswer", "explanation"]
            }
        }
    },
    required: ["passed", "scorePercentage", "corrections"]
};

export const gradeFrenchTest = async (questions, userAnswers) => {
    const answersForGrading = questions.map((q, index) => ({
        question: q.question,
        options: q.options,
        correctAnswerLetter: q.answer,
        userAnswerLetter: userAnswers[index] || "Not answered"
    }));

    const prompt = `
        You are a French language test grader. Grade the following test based on the user's answers. The pass mark is 80%.
        For each incorrect answer, provide a concise, helpful explanation in English about why the user's choice was wrong and the correct answer was right.
        Respond ONLY with a JSON object matching the provided schema.

        Test data:
        ${JSON.stringify(answersForGrading, null, 2)}
    `;

    try {
        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: gradingSchema,
            }
        });

        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error grading French test:", error);
        throw handleApiError(error);
    }
};
