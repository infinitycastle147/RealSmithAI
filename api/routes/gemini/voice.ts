import { Router, Request, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import { enforceQuota } from '../../middleware/quota';
import { QuotaService } from '../../services/quota';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  // Estimate tokens for quota check (TTS: ~100 tokens per word, estimate from text length)
  const textLength = (req.body.text || '').length;
  const estimatedTokens = Math.max(100, Math.ceil(textLength / 4)); // ~4 chars per token
  const hasQuota = await enforceQuota(req, res, estimatedTokens);
  if (!hasQuota) {
    return; // Response already sent by enforceQuota
  }

  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Missing required field: text', code: 'MISSING_FIELDS' });
    }

    // Initialize Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set');
      return res.status(500).json({ error: 'Server configuration error', code: 'SERVER_ERROR' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const voiceName = voice || 'Kore';

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio data received', code: 'NO_AUDIO_DATA' });
    }

    // Extract token usage from response
    const usageMetadata = response.usageMetadata;
    const inputTokens = usageMetadata?.promptTokenCount || 0;
    const outputTokens = usageMetadata?.candidatesTokenCount || 0;
    const totalTokens = inputTokens + outputTokens || estimatedTokens; // Fallback to estimate

    // Deduct tokens from quota
    const quotaService = req.quotaService as QuotaService;
    if (quotaService && totalTokens > 0) {
      await quotaService.deductTokens(
        userId,
        totalTokens,
        'gemini-2.5-flash-preview-tts',
        'voice',
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

    // Return base64 PCM data - client will convert to WAV/AudioBuffer
    return res.status(200).json({ 
      data: {
        base64Audio,
        sampleRate: 24000 // Default sample rate for this model
      }
    });
  } catch (error: any) {
    console.error("Voice generation failed:", error);
    return res.status(500).json({ 
      error: error.message || 'Voice generation failed', 
      code: 'GENERATION_ERROR' 
    });
  }
});

export default router;
