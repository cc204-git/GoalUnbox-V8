import { GoogleGenAI, Type } from "@google/genai";

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

export const extractCodeFromImage = async (base64Image, mimeType) => {
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

export const verifyGoalCompletion = async (goal, images) => {
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
        return jsonResponse;

    } catch (error) {
        console.error("Error verifying goal completion:", error);
        throw new Error("Failed to verify goal. The AI model could not process the request.");
    }
};

export const createVerificationChat = (
    goal,
    images,
    initialVerification,
) => {
    const imageParts = images.map(image => ({
        inlineData: { data: image.base64, mimeType: image.mimeType },
    }));

    const initialUserContent = {
        role: 'user',
        parts: [
            { text: `My goal is: "${goal}". Here is my proof.` },
            ...imageParts,
        ],
    };

    const initialModelContent = {
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
