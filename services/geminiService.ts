import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse } from "../types";

const apiKey = process.env.API_KEY || '';
// Note: In a real production app, handle missing key gracefully.
// For this demo, we assume the environment injects it.

const ai = new GoogleGenAI({ apiKey });

export const analyzeSlide = async (base64Image: string): Promise<AIResponse> => {
  if (!apiKey) {
    throw new Error("API Key not found");
  }

  try {
    // Remove header if present (e.g. data:image/png;base64,)
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: cleanBase64
            }
          },
          {
            text: "You are an expert teaching assistant. Analyze this slide. Provide a concise summary of the key teaching points and generating 2 discussion questions for students. Output in JSON."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "A concise summary of the slide content." },
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Two discussion questions based on the slide."
            }
          },
          required: ["summary", "questions"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    return JSON.parse(text) as AIResponse;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
