import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY" || key.trim() === "") {
    throw new Error("MISSING_API_KEY");
  }
  return key;
};

export async function parseQuestions(rawText: string): Promise<Question[]> {
  let apiKey;
  try {
    apiKey = getApiKey();
  } catch (e) {
    throw e;
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Parse the following text into a structured JSON array of exam questions.
    The input might be in a 5-column pipe format: Type | Question | Options/Unit | Answer | Explanation
    Or it might be raw unstructured text.
    
    Rules:
    - Type: 'MCQ' or 'NUM'.
    - Question: The question text (can include LaTeX).
    - Options: For MCQ, an array of strings. For NUM, null.
    - Unit: For NUM, the unit string (e.g., 'kg', 'm/s'). For MCQ, null.
    - Answer: The correct answer (string).
    - Explanation: Detailed explanation (can include LaTeX).
    
    Input Text:
    ${rawText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['MCQ', 'NUM'] },
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            unit: { type: Type.STRING },
            answer: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['id', 'type', 'question', 'answer', 'explanation'],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
