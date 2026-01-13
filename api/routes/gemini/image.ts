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
    const totalTokens = inputTokens + outputTokens || 500; // Fallback estimate

    // Iterate through parts to find the image, as recommended
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
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
            outputTokens
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
        outputTokens
      );
    }

    const placeholderUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
    return res.status(200).json({ data: placeholderUrl });
  } catch (error: any) {
    console.warn("Image generation failed, falling back to placeholder", error);
    const placeholderUrl = `https://picsum.photos/1080/1920?random=${Date.now()}`;
    return res.status(200).json({ data: placeholderUrl });
  }
});

export default router;
