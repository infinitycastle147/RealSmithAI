import { ScriptSegment, VoiceName } from "../types";
import { base64PcmToWavBlob } from "../utils/audio";
import { getApiUrl } from "../utils/api";

let decoderCtx: AudioContext | null = null;
const getDecoderCtx = () => {
  if (!decoderCtx) {
    decoderCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return decoderCtx;
};

/**
 * Helper function to call backend API with authentication
 * Includes error handling for session expiration and network failures
 */
async function callBackendAPI(endpoint: string, body: any, token?: string | null): Promise<any> {
  // Token is required for all API calls
  if (!token) {
    throw new Error('Authentication required. Please sign in to continue.');
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Always include Authorization header
    };

    const response = await fetch(getApiUrl(endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

  if (response.status === 401) {
    // Session expired - store intended action and redirect
    sessionStorage.setItem('pendingAction', JSON.stringify({ endpoint, body }));
    window.location.href = '/sign-in';
    throw new Error('Session expired. Please sign in again.');
  }

  if (response.status === 429) {
    // Quota exceeded
    const errorData = await response.json().catch(() => ({ error: 'Quota exceeded' }));
    const quotaError = new Error(errorData.error || 'Quota exceeded');
    (quotaError as any).code = 'QUOTA_EXCEEDED';
    (quotaError as any).resetTime = errorData.resetTime;
    (quotaError as any).tokensRemaining = errorData.tokensRemaining;
    (quotaError as any).requestsRemaining = errorData.requestsRemaining;
    throw quotaError;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  // Update quota from response headers if available
  const tokensRemaining = response.headers.get('X-Quota-Tokens-Remaining');
  const requestsRemaining = response.headers.get('X-Quota-Requests-Remaining');
  if (tokensRemaining !== null || requestsRemaining !== null) {
    // Trigger quota refresh in QuotaDisplay component via custom event
    window.dispatchEvent(new CustomEvent('quota-updated'));
  }

    const data = await response.json();
    return data.data; // Extract data from { data: ... } response format
  } catch (error: any) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

/**
 * Generates a factually grounded script using backend API.
 */
export const generateScript = async (topic: string, style: string, token?: string | null): Promise<{ segments: ScriptSegment[], sources: any[] }> => {
  try {
    const result = await callBackendAPI('gemini/script', { topic, style }, token);
    return {
      segments: result.segments || [],
      sources: result.sources || []
    };
  } catch (error) {
    console.error("Script generation failed:", error);
    throw error;
  }
};

/**
 * Generates cinematic visuals using the backend API.
 */
export const generateImageForSegment = async (description: string, style: string, token?: string | null): Promise<string> => {
  try {
    const imageDataUrl = await callBackendAPI('gemini/image', { description, style }, token);
    return imageDataUrl;
  } catch (error) {
    console.warn("Image generation failed, falling back to placeholder", error);
    return `https://picsum.photos/1080/1920?random=${Date.now()}`;
  }
};

/**
 * Synthesizes voiceovers with low-latency decoding.
 * Returns base64 PCM data from backend, then processes client-side.
 */
export const generateVoiceForSegment = async (text: string, voice: VoiceName = 'Kore', token?: string | null): Promise<{ audioUrl: string, duration: number, buffer: AudioBuffer }> => {
  try {
    const result = await callBackendAPI('gemini/voice', { text, voice }, token);
    const { base64Audio, sampleRate } = result;

    if (!base64Audio) {
      throw new Error("No audio data received");
    }

    // Convert base64 PCM to WAV blob (client-side processing)
    const wavBlob = base64PcmToWavBlob(base64Audio, sampleRate || 24000);
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
