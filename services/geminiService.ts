
import { GoogleGenAI, Type, Chat, Content } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const verificationSystemInstruction = `You are a strict goal completion verifier. The user's goal is provided. The user has submitted images as proof. Analyze the images and conversation to determine if the goal has been fully met. Be critical. Respond ONLY with a JSON object matching the provided schema. In the feedback, provide a summary, list the specific parts of the goal that were approved based on the images, and the specific parts that are still missing or not proven. If the user convinces you the goal is complete, set "completed" to true.`;

const verificationSchema = {
    type: Type.OBJECT,
    properties: {
        completed: {
            type: Type.BOOLEAN,
            description: "True if the goal is verifiably completed based on the image, otherwise false."
        },
        feedback: {
            type: Type.OBJECT,
            description: "Detailed feedback on goal completion.",
            properties: {
                summary: {
                    type: Type.STRING,
                    description: "A one-sentence summary of the verification result."
                },
                approved_aspects: {
                    type: Type.ARRAY,
                    description: "A list of specific parts of the goal that were successfully verified from the images.",
                    items: { type: Type.STRING }
                },
                missing_aspects: {
                    type: Type.ARRAY,
                    description: "A list of specific parts of the goal that were not met or could not be verified from the images.",
                    items: { type: Type.STRING }
                }
            },
            required: ["summary", "approved_aspects", "missing_aspects"]
        },
    },
    required: ["completed", "feedback"],
};

export const extractCodeFromImage = async (base64Image: string, mimeType: string): Promise<string> => {
  try {
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
    console.error("Error extracting code from image:", error);
    throw new Error("Failed to analyze the image. The AI model might be unavailable or the image format could be unsupported.");
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

export const verifyGoalCompletion = async (goal: string, images: { base64: string, mimeType: string }[]): Promise<VerificationResult> => {
    try {
        const imageParts = images.map(image => ({
            inlineData: {
                data: image.base64,
                mimeType: image.mimeType,
            },
        }));

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    {
                        text: `The user's goal is: "${goal}". Here is my proof.`
                    },
                    ...imageParts,
                ],
            },
            config: {
                systemInstruction: verificationSystemInstruction,
                responseMimeType: "application/json",
                responseSchema: verificationSchema,
            }
        });
        
        const jsonResponse = JSON.parse(response.text);
        return jsonResponse as VerificationResult;

    } catch (error) {
        console.error("Error verifying goal completion:", error);
        throw new Error("Failed to verify goal. The AI model could not process the request.");
    }
};

export const createVerificationChat = (
    goal: string,
    images: { base64: string, mimeType: string }[],
    initialVerification: VerificationResult,
): Chat => {
    const imageParts = images.map(image => ({
        inlineData: { data: image.base64, mimeType: image.mimeType },
    }));

    const initialUserContent: Content = {
        role: 'user',
        parts: [
            { text: `My goal is: "${goal}". Here is my proof.` },
            ...imageParts,
        ],
    };

    const initialModelContent: Content = {
        role: 'model',
        parts: [
            { text: JSON.stringify(initialVerification) }
        ],
    };

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: [initialUserContent, initialModelContent],
        config: {
            systemInstruction: verificationSystemInstruction,
            responseMimeType: "application/json",
            responseSchema: verificationSchema,
        },
    });

    return chat;
};

// --- New Emergency Test Feature ---

export interface FrenchTestQuestion {
  question: string;
  options: string[];
  answer: string;
}

export interface FrenchTestData {
  paragraphB2: string;
  paragraphC1: string;
  questions: FrenchTestQuestion[];
}

export interface TestCorrection {
  questionNumber: number;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export interface GradingResult {
  scorePercentage: number;
  passed: boolean;
  corrections: TestCorrection[];
}

const frenchTestSchema = {
    type: Type.OBJECT,
    properties: {
        paragraphB2: { type: Type.STRING, description: "A paragraph in French at B2 level." },
        paragraphC1: { type: Type.STRING, description: "The same paragraph rewritten at C1 level." },
        questions: {
            type: Type.ARRAY,
            description: "An array of 20 multiple-choice questions.",
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        description: "An array of exactly 4 string options.",
                        items: { type: Type.STRING }
                    },
                    answer: { type: Type.STRING, description: "The correct option letter (e.g., 'A')." }
                },
                required: ["question", "options", "answer"]
            }
        }
    },
    required: ["paragraphB2", "paragraphC1", "questions"]
};

const gradingSchema = {
    type: Type.OBJECT,
    properties: {
        scorePercentage: { type: Type.NUMBER, description: "The user's score as a percentage." },
        passed: { type: Type.BOOLEAN, description: "True if score is 80% or higher." },
        corrections: {
            type: Type.ARRAY,
            description: "An array of feedback for each incorrect answer.",
            items: {
                type: Type.OBJECT,
                properties: {
                    questionNumber: { type: Type.NUMBER, description: "The 1-based index of the question." },
                    userAnswer: { type: Type.STRING },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING, description: "Explanation of the correct answer." }
                },
                required: ["questionNumber", "userAnswer", "correctAnswer", "explanation"]
            }
        }
    },
    required: ["scorePercentage", "passed", "corrections"]
};

export const generateFrenchTest = async (level: 'B2' | 'C1'): Promise<FrenchTestData> => {
    const prompt = `You are a French language teaching assistant. Your task is to generate a language proficiency test for a user at the ${level.toUpperCase()} level. The test must be structured as a single JSON object adhering to the provided schema.

The test should consist of two parts:
1.  **Reading Comprehension**:
    a. First, write a short paragraph in French (around 5-7 sentences) at a B2 level.
    b. Then, rewrite that same paragraph into a more sophisticated C1 level version, using more advanced vocabulary, complex sentence structures, and richer expressions.
    c. Based **only** on the C1 paragraph, create 10 multiple-choice comprehension questions. Each question must have exactly four options (A, B, C, D), and you must specify the correct answer letter. The questions should test understanding of the main ideas, details, and vocabulary in the C1 text.

2.  **General Knowledge**:
    a. Create 10 general French knowledge questions appropriate for the ${level.toUpperCase()} level.
    b. These questions should cover grammar points like verb conjugations (especially subjunctive, conditional), pronoun usage, prepositions, and vocabulary nuances (e.g., difference between similar words).
    c. These questions must also be multiple-choice with four options (A, B, C, D) and a specified correct answer letter.

Ensure the final output is a valid JSON object matching the schema. Do not include any text or explanations outside of the JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: frenchTestSchema,
            }
        });
        return JSON.parse(response.text) as FrenchTestData;
    } catch (error) {
        console.error("Error generating French test:", error);
        throw new Error("Failed to generate the French test. The AI model might be unavailable.");
    }
};

export const gradeFrenchTest = async (questions: FrenchTestQuestion[], userAnswers: { [key: number]: string }): Promise<GradingResult> => {
    const prompt = `You are an expert French language examiner. Your task is to grade a user's test answers and provide feedback.

Here is the original set of questions and their correct answers:
${JSON.stringify(questions)}

Here are the user's submitted answers, where the key is the question index (0-based) and the value is the selected option letter:
${JSON.stringify(userAnswers)}

Your tasks are:
1.  Compare the user's answers to the correct answers for all 20 questions.
2.  Calculate the final score as a percentage. The score is (number of correct answers / 20) * 100.
3.  Determine if the user passed. The passing threshold is 80%.
4.  For **each** incorrect answer, create a correction object. This object must include the question number (1-based), the user's incorrect answer, the correct answer, and a clear, concise explanation in English of why the user's answer is wrong and the correct answer is right. The explanation should be helpful for a language learner.

Return a single, valid JSON object that strictly follows the provided schema. Do not include any text or explanations outside of this JSON object.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: gradingSchema,
            }
        });
        return JSON.parse(response.text) as GradingResult;
    } catch (error) {
        console.error("Error grading French test:", error);
        throw new Error("Failed to grade the test. The AI model could not process the request.");
    }
};

export const summarizeGoal = async (goal: string): Promise<string> => {
    const prompt = `Summarize the following user goal into a single, concise phrase suitable for a table entry. Be direct and do not add quotes. For example, if the goal is "Finish writing chapter 1 of my book, ensuring it is at least 3,000 words.", a good summary would be "Write chapter 1 (3,000 words)". Goal: "${goal}"`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error summarizing goal:", error);
        // Fallback to simple truncation
        return goal.length > 50 ? goal.substring(0, 47) + '...' : goal;
    }
};
