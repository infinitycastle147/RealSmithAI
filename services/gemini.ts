
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { ScriptSegment, VoiceName } from "../types";
import { base64PcmToWavBlob } from "../utils/audio";

let aiInstance: GoogleGenAI | null = null;
const getAI = () => {
  if (!aiInstance) {
    // strict adherence to SDK initialization with named parameter
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
 * Helper to strip markdown code blocks and find JSON array in response
 */
const cleanJsonOutput = (text: string): string => {
  if (!text) return "[]";
  let clean = text.trim();
  
  // Remove markdown code blocks if present
  if (clean.includes('```')) {
    clean = clean.replace(/```(?:json)?/g, '').replace(/```/g, '');
  }

  // Find the first '[' and last ']' to extract the array
  const firstBracket = clean.indexOf('[');
  const lastBracket = clean.lastIndexOf(']');
  
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    clean = clean.substring(firstBracket, lastBracket + 1);
  }

  return clean;
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
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
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

    // Robust text extraction and parsing
    const text = response.text || "[]";
    const cleanedText = cleanJsonOutput(text);
    
    let segments;
    try {
        segments = JSON.parse(cleanedText);
    } catch (e) {
        console.error("JSON Parse Error on output:", cleanedText);
        throw new Error("Failed to parse AI response");
    }

    // Extract grounding chunks for factual transparency in the UI
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return {
      segments: segments.map((seg: any, index: number) => ({
        id: `seg-${index}-${Date.now()}`,
        narration: seg.narration || "",
        visualDescription: seg.visualDescription || ""
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
    
    // Iterate through parts to find the image, as recommended
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
             return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }
    throw new Error("No image data found in response");
  } catch (error) {
    console.warn("Image generation failed, falling back to placeholder", error);
    return `https://picsum.photos/1080/1920?random=${Date.now()}`;
  }
};

/**
 * Synthesizes voiceovers with low-latency decoding.
 */
export const generateVoiceForSegment = async (text: string, voice: VoiceName = 'Kore'): Promise<{ audioUrl: string, duration: number, buffer: AudioBuffer }> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data received");

    // Use default sample rate if not specified, but usually it's 24000 for this model
    const wavBlob = base64PcmToWavBlob(base64Audio, 24000); 
    const audioUrl = URL.createObjectURL(wavBlob);
    
    const ctx = getDecoderCtx();
    // Ensure context is running (browsers might suspend it)
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }

    const arrayBuffer = await wavBlob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    return { audioUrl, duration: audioBuffer.duration, buffer: audioBuffer };
  } catch (error) {
    console.error("Voice generation failed:", error);
    throw error;
  }
};
