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

export function base64PcmToWavBlob(base64Pcm: string, sampleRate: number = 24000): Blob {
    // 1. Decode Base64 to raw bytes
    const rawBytes = base64ToUint8Array(base64Pcm);
    
    // 2. Convert raw bytes (assuming Little Endian Int16 from Gemini) to Int16Array
    // Note: Gemini Text-to-Speech typically returns 24kHz Linear16 PCM
    const int16Array = new Int16Array(rawBytes.buffer);

    // 3. Wrap in WAV container
    return pcmToWav(int16Array, sampleRate);
}