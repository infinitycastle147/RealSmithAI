
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptSegment, VoiceName } from "../types";
import { base64PcmToWavBlob } from "../utils/audio";

let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return aiInstance;
};

let decoderCtx: AudioContext | null = null;
const getDecoderCtx = () => {
  if (!decoderCtx) {
    decoderCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return decoderCtx;
};

/**
 * Generates a factually grounded script using Dedicated System Instructions and Search Grounding.
 */
export const generateScript = async (topic: string, style: string): Promise<{ segments: ScriptSegment[], sources: any[] }> => {
  const ai = getAI();
  
  // Dedicated System Instruction: Defines persona, constraints, and output goals.
  const systemInstruction = `
    You are an elite Viral Content Strategist specializing in vertical short-form video (YouTube Shorts, TikTok).
    
    CORE DIRECTIVES:
    1. RETENTION-FIRST: Every script must start with a 'Scroll-Stopping Hook' (0-5s).
    2. NARRATIVE ARC: The body must provide high-value information or entertainment with logical transitions.
    3. CALL TO ACTION: End with a strong, single CTA.
    4. VISUAL STORYBOARDING: Descriptions for visual segments must be cinematic and fit a 9:16 aspect ratio.
    5. FACTUAL INTEGRITY: Use Google Search to verify any real-world claims, news, or historical data.
    
    OUTPUT FORMAT:
    - You must return a valid JSON array of objects.
    - Each object must have: 'narration' (string) and 'visualDescription' (string).
    - Provide exactly 6 segments for a 60-second video.
  `;

  const userPrompt = `Create a script about the following topic: "${topic}". 
  The visual aesthetic for all scenes should be: "${style}". 
  Ensure the narration is punchy and the facts are up-to-date.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
        maxOutputTokens: 8000,
        // Using a healthy thinking budget for narrative planning
        thinkingConfig: { thinkingBudget: 4000 },
        // Enabling Google Search Grounding for live information retrieval
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              narration: { type: Type.STRING },
              visualDescription: { type: Type.STRING },
            },
            required: ['narration', 'visualDescription']
          }
        }
      }
    });

    const text = response.text || "[]";
    const segments = JSON.parse(text);
    // Extract grounding chunks for factual transparency in the UI
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      segments: segments.map((seg: any, index: number) => ({
        id: `seg-${index}-${Date.now()}`,
        ...seg
      })),
      sources
    };
  } catch (error) {
    console.error("Script generation failed:", error);
    throw error;
  }
};

/**
 * Generates cinematic visuals using the flash-image model.
 */
export const generateImageForSegment = async (description: string, style: string): Promise<string> => {
  const ai = getAI();
  const finalPrompt = `
    Cinematic 9:16 vertical photography. 
    Style: ${style}. 
    Subject: ${description}. 
    Atmospheric depth, professional lighting, photorealistic textures, 8k resolution. 
    No text, logos, or watermarks.
  `;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: finalPrompt }] },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    throw new Error("No image data");
  } catch (error) {
    return `https://picsum.photos/1080/1920?random=${Date.now()}`;
  }
};

/**
 * Synthesizes voiceovers with low-latency decoding.
 */
export const generateVoiceForSegment = async (text: string, voice: VoiceName = 'Kore'): Promise<{ audioUrl: string, duration: number, buffer: AudioBuffer }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text.trim() }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data");

  const wavBlob = base64PcmToWavBlob(base64Audio, 24000); 
  const audioUrl = URL.createObjectURL(wavBlob);
  
  const ctx = getDecoderCtx();
  const arrayBuffer = await wavBlob.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  
  return { audioUrl, duration: audioBuffer.duration, buffer: audioBuffer };
};
