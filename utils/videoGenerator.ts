
import { GeneratedSegment } from "../types";
import { calculateTextLayout, TextLayout } from "./layout";

/**
 * Optimized Video Renderer.
 * Uses batch loading, precise audio context timing, and deterministic frame pushing.
 */
export async function renderVideo(
  segments: GeneratedSegment[], 
  onProgress: (status: string) => void,
  options: { showCaptions?: boolean; format?: 'webm' | 'mp4' } = {}
): Promise<{ url: string; actualMime: string }> {
  const { showCaptions = true, format = 'mp4' } = options;
  const WIDTH = 720;
  const HEIGHT = 1280;
  
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas context failed");

  // Initializing global state once
  ctx.font = `bold ${Math.floor(HEIGHT * 0.035)}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioContext.state === 'suspended') await audioContext.resume();

  const dest = audioContext.createMediaStreamDestination();
  const canvasStream = canvas.captureStream(30);
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  const mimeType = (format === 'mp4' ? ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm'])
    .find(t => MediaRecorder.isTypeSupported(t)) || '';

  const mediaRecorder = new MediaRecorder(mixedStream, { mimeType, videoBitsPerSecond: 8000000 });
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  // Pre-calculate all layouts outside the loop
  const layoutCache = new Map<string, TextLayout>();
  segments.forEach(seg => {
    if (seg.narration) layoutCache.set(seg.id, calculateTextLayout(ctx, seg.narration, WIDTH * 0.85, HEIGHT * 0.75, Math.floor(HEIGHT * 0.035)));
  });

  // Batch load images
  onProgress("Pre-loading visuals...");
  const images = await Promise.all(segments.map(s => new Promise<HTMLImageElement | null>((r) => {
    if (!s.imageUrl) return r(null);
    const img = new Image();
    img.src = s.imageUrl;
    img.onload = () => r(img);
    img.onerror = () => r(null);
  })));

  return new Promise(async (resolve) => {
    mediaRecorder.onstop = () => {
      const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
      audioContext.close();
      resolve({ url, actualMime: mimeType });
    };

    mediaRecorder.start();

    const drawCaptions = (segId: string, progress: number) => {
      if (!showCaptions) return;
      const layout = layoutCache.get(segId);
      if (!layout) return;

      const sidePadding = (WIDTH - (WIDTH * 0.85)) / 2;
      const activeWord = layout.flattenedWords.find(w => progress >= w.startTime && progress < w.endTime);
      
      layout.lines.forEach(line => {
        line.words.forEach(word => {
          const x = sidePadding + word.x;
          const y = line.y;
          const isActive = word === activeWord;
          if (isActive) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.roundRect(x - 6, y - (layout.fontSize * 0.65), word.width + 12, layout.fontSize * 1.3, 8);
            ctx.fill();
          }
          ctx.fillStyle = isActive ? '#000' : '#fff';
          ctx.fillText(word.text, x + word.width / 2, y);
        });
      });
    };

    // Sequential scene rendering
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const img = images[i];
      const buffer = seg.audioBuffer;
      if (!buffer) continue;

      onProgress(`Encoding Scene ${i + 1}/${segments.length}`);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(dest);
      source.start();

      const FPS = 30;
      const frameDuration = 1000 / FPS;
      const totalFrames = buffer.duration * FPS;

      for (let f = 0; f < totalFrames; f++) {
        const frameStart = Date.now();
        const progress = f / totalFrames;
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        if (img) ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
        drawCaptions(seg.id, progress);

        // Forced deterministic throttle for MediaRecorder buffer stability
        const elapsed = Date.now() - frameStart;
        if (elapsed < frameDuration) await new Promise(r => setTimeout(r, frameDuration - elapsed));
      }
    }

    mediaRecorder.stop();
  });
}
