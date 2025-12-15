import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptSegment } from "../types";
import { base64PcmToWavBlob } from "../utils/audio";

// Check for API Key
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

/**
 * Generates a structured script for a 60-second YouTube Short.
 */
export const generateScript = async (topic: string): Promise<ScriptSegment[]> => {
  // OPTIMIZED PROMPT:
  // 1. Role defined (Viral Content Strategist).
  // 2. Constraints explicit (Visual fit for captions, pacing).
  // 3. Output format strict.
  const prompt = `
    You are an expert Viral Content Strategist for YouTube Shorts.
    Your task is to generate a high-retention, fast-paced script for a 60-second video about: "${topic}".

    ## CONSTRAINTS
    1. **Structure**: Exactly 6 segments.
    2. **Total Duration**: ~60 seconds.
    3. **Pacing**: Hook (0-5s) -> Value/Story (5-50s) -> Conclusion/CTA (50-60s).

    ## OUTPUT FORMAT (JSON Array)
    For each segment, provide:
    1. **narration**: The spoken text.
       - **CRITICAL**: The text is displayed as on-screen captions. To fit the video layout, **MAXIMUM 30 WORDS per segment**.
       - Tone: Conversational, energetic, punchy. No fluff.
    2. **visualDescription**: A prompt for an AI image generator.
       - Describe the scene visually (lighting, subject, angle).
       - Do NOT ask for text inside the image.

    Generate the JSON response now.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
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

    const segments = JSON.parse(response.text || "[]");
    return segments.map((seg: any, index: number) => ({
      id: `seg-${index}-${Date.now()}`,
      ...seg
    }));
  } catch (error) {
    console.error("Script generation failed:", error);
    throw new Error("Failed to generate script. Please try again.");
  }
};

/**
 * Generates an image for a specific segment based on style and description.
 */
export const generateImageForSegment = async (description: string, style: string): Promise<string> => {
  // OPTIMIZED PROMPT:
  // Front-loads the style and technical requirements for better adherence by the vision model.
  const finalPrompt = `
    [Artistic Direction]: ${style}
    [Subject]: ${description}
    [Technical]: Vertical 9:16 aspect ratio composition, high contrast, professional lighting, centered subject, 8k resolution, highly detailed.
    [Negative]: Do not include text, do not include watermarks, no blurry elements, no distorted features.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: finalPrompt }]
      }
    });

    // Check all parts for image data
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Image generation failed:", error);
    // Return a fallback placeholder if generation fails
    return `https://picsum.photos/1080/1920?random=${Date.now()}`;
  }
};

/**
 * Generates voiceover audio for a segment.
 */
export const generateVoiceForSegment = async (text: string): Promise<{ audioUrl: string, duration: number }> => {
  try {
    if (!text || !text.trim()) {
      throw new Error("Narration text is empty.");
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      // Fix: Correct structure for TTS endpoint - contents array
      contents: [{
        parts: [{ text: text.trim() }]
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' } // 'Kore', 'Fenrir', 'Puck', 'Zephyr'
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data received");
    }

    const wavBlob = base64PcmToWavBlob(base64Audio, 24000); 
    const audioUrl = URL.createObjectURL(wavBlob);
    
    // Calculate duration
    const audioContext = new AudioContext();
    const arrayBuffer = await wavBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;
    audioContext.close();

    return { audioUrl, duration }; 

  } catch (error) {
    console.error("Voice generation failed:", error);
    throw error;
  }
};