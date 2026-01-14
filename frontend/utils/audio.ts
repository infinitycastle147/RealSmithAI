
// Utility to convert raw PCM data (Float32 or Int16) to WAV for browser playback

export function pcmToWav(pcmData: Int16Array | Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitDepth = 16;
  
  let data: Int16Array;
  if (pcmData instanceof Float32Array) {
    data = new Int16Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      // Clamp values between -1 and 1
      const s = Math.max(-1, Math.min(1, pcmData[i]));
      data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  } else {
    data = pcmData;
  }

  const buffer = new ArrayBuffer(44 + data.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + data.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, data.length * 2, true);

  // Write PCM data
  const offset = 44;
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset + i * 2, data[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Trims silence from BOTH ends of an Int16 PCM buffer.
 * ensuring captions align perfectly with speech start.
 */
export function trimSilence(data: Int16Array, threshold = 0.01): Int16Array {
  // 16-bit PCM range is -32768 to 32767. 
  // Threshold 0.01 is ~327.
  const intThreshold = 32768 * threshold;
  
  let start = 0;
  let end = data.length - 1;

  // Scan forward for first sound
  while (start < end && Math.abs(data[start]) < intThreshold) {
    start++;
  }

  // Scan backwards for last sound
  while (end > start && Math.abs(data[end]) < intThreshold) {
    end--;
  }

  // If the entire buffer is silence (start >= end), return a small empty buffer
  if (start >= end) {
    return new Int16Array(0);
  }

  // Add small padding (50ms) to both ends for natural attack/decay
  // 24000 Hz * 0.05s = 1200 samples
  const padding = 1200;
  
  // Adjust start/end with padding, clamping to bounds
  const paddedStart = Math.max(0, start - padding);
  const paddedEnd = Math.min(data.length, end + padding);

  return data.subarray(paddedStart, paddedEnd);
}

export function base64PcmToWavBlob(base64Pcm: string, sampleRate: number = 24000): Blob {
    // 1. Decode Base64 to raw bytes
    const rawBytes = base64ToUint8Array(base64Pcm);
    
    // 2. Convert raw bytes (assuming Little Endian Int16 from Gemini) to Int16Array
    const int16Array = new Int16Array(rawBytes.buffer);

    // 3. Trim silence from start AND end
    const trimmed = trimSilence(int16Array);

    // 4. Wrap in WAV container
    return pcmToWav(trimmed, sampleRate);
}
