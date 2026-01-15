import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { createImagePrompt } from '../../../prompts/image';
import { enforceQuota } from '../../middleware/quota';
import { QuotaService } from '../../services/quota';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  // Estimate tokens for quota check (image generation: ~500 tokens)
  const estimatedTokens = 500;
  const hasQuota = await enforceQuota(req, res, estimatedTokens);
  if (!hasQuota) {
    return; // Response already sent by enforceQuota
  }

  try {
    const { description, style } = req.body;

    if (!description || !style) {
      return res.status(400).json({ error: 'Missing required fields: description and style', code: 'MISSING_FIELDS' });
    }

    // Initialize Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error', code: 'SERVER_ERROR' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const finalPrompt = createImagePrompt(description, style);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts: [{ text: finalPrompt }] },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });
    
    // Extract token usage from response
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    // Use actual tokens if available, otherwise fallback to estimated tokens
    const totalTokens = (inputTokens + outputTokens) > 0 
      ? (inputTokens + outputTokens) 
      : estimatedTokens;

    // Iterate through parts to find the image, as recommended
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image')) {
        const imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        
        // Deduct tokens from quota
        const quotaService = req.quotaService as QuotaService;
        if (quotaService) {
          await quotaService.deductTokens(
            userId,
            totalTokens,
            'gemini-2.5-flash-image',
            'image',
            inputTokens,
            outputTokens,
            estimatedTokens // Pass estimated tokens for validation
          );
        }

        // Get updated quota status for response headers
        const quotaStatus = quotaService ? await quotaService.getUserQuota(userId) : null;
        if (quotaStatus) {
          res.setHeader('X-Quota-Tokens-Remaining', quotaStatus.tokensRemaining.toString());
          res.setHeader('X-Quota-Requests-Remaining', quotaStatus.requestsRemaining.toString());
          res.setHeader('X-Quota-Reset-Time', quotaStatus.resetTime.toISOString());
        }

        return res.status(200).json({ data: imageDataUrl });
      }
    }
    
    // Fallback to placeholder (still deduct tokens for the API call)
    const quotaService = req.quotaService as QuotaService;
    if (quotaService && totalTokens > 0) {
      await quotaService.deductTokens(
        userId,
        totalTokens,
        'gemini-2.5-flash-image',
        'image',
        inputTokens,
        outputTokens,
        estimatedTokens // Pass estimated tokens for validation
      );
    }

    const placeholderUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
    return res.status(200).json({ data: placeholderUrl });
  } catch (error: any) {
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
      return res.status(500).json({ 
        error: 'AI service authentication failed. Please check the API key configuration.',
        code: 'GEMINI_AUTH_ERROR'
      });
    }
    
    // Fallback to placeholder for other errors
    const placeholderUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
    return res.status(200).json({ data: placeholderUrl });
  }
});

export default router;
