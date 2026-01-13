import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { SCRIPT_SYSTEM_INSTRUCTION, createScriptUserPrompt } from '../../prompts/script';
import { requireAuth } from '../_middleware';
import { enforceQuota } from '../middleware/quota';
import { QuotaService } from '../services/quota';

// Helper to strip markdown code blocks and find JSON array in response
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  // Verify authentication
  const userId = await requireAuth(req, res);
  if (!userId) {
    return; // Response already sent by requireAuth
  }

  // Set userId on request for quota middleware
  (req as any).userId = userId;

  // Estimate tokens for quota check (rough estimate: ~1000 tokens for script generation)
  const estimatedTokens = 1000;
  const hasQuota = await enforceQuota(req, res, estimatedTokens);
  if (!hasQuota) {
    return; // Response already sent by enforceQuota
  }

  try {
    const { topic, style } = req.body;

    if (!topic || !style) {
      return res.status(400).json({ error: 'Missing required fields: topic and style', code: 'MISSING_FIELDS' });
    }

    // Initialize Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error', code: 'SERVER_ERROR' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const userPrompt = createScriptUserPrompt(topic, style);

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction: SCRIPT_SYSTEM_INSTRUCTION,
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
      return res.status(500).json({ error: 'Failed to parse AI response', code: 'PARSE_ERROR' });
    }

    // Extract grounding chunks for factual transparency in the UI
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    // Extract token usage from response
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens;

    // Deduct tokens from quota
    const quotaService = (req as any).quotaService as QuotaService;
    if (quotaService && totalTokens > 0) {
      await quotaService.deductTokens(
        userId,
        totalTokens,
        'gemini-3-flash-preview',
        'script',
        inputTokens,
        outputTokens
      );
    }

    // Get updated quota status for response headers
    const quotaStatus = quotaService ? await quotaService.getUserQuota(userId) : null;

    // Set quota headers
    if (quotaStatus) {
      res.setHeader('X-Quota-Tokens-Remaining', quotaStatus.tokensRemaining.toString());
      res.setHeader('X-Quota-Requests-Remaining', quotaStatus.requestsRemaining.toString());
      res.setHeader('X-Quota-Reset-Time', quotaStatus.resetTime.toISOString());
    }

    return res.status(200).json({
      data: {
        segments: segments.map((seg: any, index: number) => ({
          id: `seg-${index}-${Date.now()}`,
          narration: seg.narration || "",
          visualDescription: seg.visualDescription || ""
        })),
        sources
      }
    });
  } catch (error: any) {
    console.error("Script generation failed:", error);
    return res.status(500).json({ 
      error: error.message || 'Script generation failed', 
      code: 'GENERATION_ERROR' 
    });
  }
}
