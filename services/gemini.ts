
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptSegment, VoiceName } from "../types";
import { base64PcmToWavBlob, base64ToUint8Array } from "../utils/audio";

/**
 * Generates a structured script for a 60-second YouTube Short.
 */
export const generateScript = async (topic: string, style: string): Promise<ScriptSegment[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Revised prompt based on Senior Prompt Engineer review
  const prompt = `
    Narrative Script Engine for Vertical Short-Form Content.
    Objective: Generate a 6-segment JSON script for a 60-second video.
    
    Topic Context: "${topic}"
    Visual Style Context: "${style}"

    ## NARRATIVE ARCHITECTURE & PACING
    - Segment 1: Hook (Target: 5 seconds). Capture immediate interest. Length: 60-80 characters.
    - Segments 2-5: Body/Value (Target: 45 seconds total). Maintain momentum with short, punchy sentences. Length per segment: 130-160 characters.
    - Segment 6: Conclusion/CTA (Target: 10 seconds). Strong summary and call to action. Length: 100-120 characters.

    ## VISUAL CONSTRAINTS
    - POV Consistency: Maintain a consistent Third-Person Cinematic POV across all visual descriptions.
    - Style Alignment: Each description must strictly adhere to the "${style}" aesthetic.
    - Subject Focus: Center the subject in vertical 9:16 framing.

    ## OUTPUT RULES
    - Use active verbs and high-energy narration style.
    - Output must be a VALID JSON ARRAY only.
    - Do not use exclamation marks in narration unless absolutely necessary.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        maxOutputTokens: 8000,
        thinkingConfig: { thinkingBudget: 4000 },
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

    // Directly parse response.text as requested by the review for application/json responses
    const rawText = response.text || "[]";
    const segments = JSON.parse(rawText);

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
 * Generates a 9:16 vertical image for a segment.
 */
export const generateImageForSegment = async (description: string, style: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Revised prompt using XML delimiters for input isolation and positive constraints
  const finalPrompt = `
    Vertical Cinematic Image Generation.
    
    <style_reference>
      ${style}
    </style_reference>
    
    <visual_content>
      ${description}
    </visual_content>

    ## COMPOSITION RULES
    - Aspect Ratio: 9:16 (Vertical)
    - Perspective: Consistent Cinematic POV
    - Details: High fidelity, pure visual representation, empty background without any typography or watermarks.
    - Lighting: Dynamic and focused on the subject.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: finalPrompt }] },
      config: {
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
    throw new Error("No image data");
  } catch (error) {
    console.error("Image generation failed:", error);
    return `https://picsum.photos/1080/1920?random=${Date.now()}`;
  }
};

/**
 * Generates voiceover using a selected voice.
 */
export const generateVoiceForSegment = async (text: string, voice: VoiceName = 'Kore'): Promise<{ audioUrl: string, duration: number }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data");

    const wavBlob = base64PcmToWavBlob(base64Audio, 24000); 
    const audioUrl = URL.createObjectURL(wavBlob);
    
    const rawBytes = base64ToUint8Array(base64Audio);
    const duration = (rawBytes.length / 2) / 24000;

    return { audioUrl, duration }; 
  } catch (error) {
    console.error("Voice generation failed:", error);
    throw error;
  }
};
