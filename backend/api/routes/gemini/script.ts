import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { SCRIPT_SYSTEM_INSTRUCTION, createScriptUserPrompt } from '../../../prompts/script';
import { enforceQuota } from '../../middleware/quota';
import { QuotaService } from '../../services/quota';

const router = Router();

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

router.post('/', async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

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

    // Log API key prefix for debugging (first 10 chars only for security)
    console.log(`Using Gemini API key: ${apiKey.substring(0, 10)}...`);

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
    const quotaService = req.quotaService as QuotaService;
    if (quotaService && totalTokens > 0) {
      await quotaService.deductTokens(
        userId,
        totalTokens,
        'gemini-3-flash-preview',
        'script',
        inputTokens,
        outputTokens,
        estimatedTokens // Pass estimated tokens for validation
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
    console.error("Error structure:", JSON.stringify(error, null, 2));
    
    // Extract error details - GoogleGenAI errors may be nested
    const errorObj = error.error || error;
    const errorCode = errorObj?.code || error.code || error.status;
    const errorMessage = errorObj?.message || error.message || '';
    const errorStatus = errorObj?.status || error.status;
    
    // Check if this is a Gemini API quota error (429 from Google)
    // Only match actual Google API errors, not generic quota messages
    const isGeminiQuotaError = 
      errorCode === 429 || 
      errorStatus === 429 || 
      errorStatus === 'RESOURCE_EXHAUSTED' ||
      (errorMessage && (
        errorMessage.toLowerCase().includes('resource exhausted') ||
        errorMessage.toLowerCase().includes('quota exceeded') && (
          errorMessage.toLowerCase().includes('api') ||
          errorMessage.toLowerCase().includes('google') ||
          errorMessage.toLowerCase().includes('gemini')
        )
      ));
    
    if (isGeminiQuotaError) {
      console.error('⚠️ Gemini API quota exceeded - API key has reached its limit');
      console.error('   Error code:', errorCode);
      console.error('   Error status:', errorStatus);
      console.error('   Error message:', errorMessage);
      return res.status(503).json({ 
        error: 'AI service quota exceeded. The API key has reached its daily limit. Please check your Google AI Studio quota or contact support.',
        code: 'GEMINI_QUOTA_EXCEEDED',
        details: 'This is a Google API key quota issue, not your user quota. The backend API key needs to be updated or quota increased.',
        originalError: errorMessage
      });
    }
    
    // Check if this is an authentication error (invalid API key)
    if (errorCode === 401 || errorStatus === 401 || 
        (errorMessage && (errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('authentication')))) {
      console.error('⚠️ Gemini API authentication failed - API key may be invalid');
      return res.status(500).json({ 
        error: 'AI service authentication failed. Please check the API key configuration.',
        code: 'GEMINI_AUTH_ERROR'
      });
    }
    
    return res.status(500).json({ 
      error: errorMessage || error.message || 'Script generation failed', 
      code: 'GENERATION_ERROR' 
    });
  }
});

export default router;
