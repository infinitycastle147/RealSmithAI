
import { GeneratedSegment } from "../types";
import { calculateTextLayout, TextLayout } from "./layout";

/**
 * Optimized Video Renderer.
 * Uses MediaRecorder with a strictly audio-synced clock to prevent frame-sticking.
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

  // Font Size standardized to 5% of HEIGHT
  const fontSize = Math.floor(HEIGHT * 0.05);
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = audioContext.createMediaStreamDestination();
  
  const canvasStream = canvas.captureStream(30);
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  const mimeType = (format === 'mp4' ? ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'] : ['video/webm;codecs=vp9', 'video/webm'])
    .find(t => MediaRecorder.isTypeSupported(t)) || '';

  const mediaRecorder = new MediaRecorder(mixedStream, { 
    mimeType, 
    videoBitsPerSecond: 12000000 // Higher bitrate for professional quality
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  // Pre-load assets
  onProgress("Pre-loading visuals...");
  const images = await Promise.all(segments.map(s => new Promise<HTMLImageElement | null>((r) => {
    if (!s.imageUrl) return r(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = s.imageUrl;
    img.onload = () => r(img);
    img.onerror = () => r(null);
  })));

  const layoutCache = new Map<string, TextLayout>();
  segments.forEach(seg => {
    layoutCache.set(seg.id, calculateTextLayout(ctx, seg.narration, WIDTH * 0.8, fontSize));
  });

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

      const blockWidth = WIDTH * 0.8;
      const blockX = (WIDTH - blockWidth) / 2;
      // Consistent with Player's 60% vertical alignment
      const blockY = (HEIGHT * 0.6) - (layout.totalHeight / 2);
      
      const activeWord = layout.flattenedWords.find(w => progress >= w.startTime && progress < w.endTime);
      
      layout.lines.forEach(line => {
        line.words.forEach(word => {
          const x = blockX + word.x;
          const y = blockY + line.y;
          const isActive = word === activeWord;
          
          if (isActive) {
            ctx.fillStyle = '#FACC15';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 10;
            const paddingX = fontSize * 0.2;
            const paddingY = fontSize * 0.1;
            ctx.beginPath();
            ctx.roundRect(x - paddingX, y - (fontSize/2) - paddingY, word.width + (paddingX * 2), fontSize + (paddingY * 2), 10);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000';
            ctx.fillText(word.text, x + word.width / 2, y);
          } else {
            ctx.lineJoin = 'round';
            ctx.lineWidth = fontSize * 0.2;
            ctx.strokeStyle = '#000';
            ctx.strokeText(word.text, x + word.width / 2, y);
            ctx.fillStyle = '#FFF';
            ctx.fillText(word.text, x + word.width / 2, y);
          }
        });
      });
    };

    // Sequential audio-driven playback
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const img = images[i];
      const buffer = seg.audioBuffer;
      if (!buffer) continue;

      onProgress(`Recording Scene ${i + 1}/${segments.length}`);
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(dest);
      
      const startTime = audioContext.currentTime;
      source.start(startTime);

      const duration = buffer.duration;
      
      const renderScene = async () => {
        return new Promise<void>((r) => {
          const frame = () => {
            const elapsed = audioContext.currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1.0);

            if (elapsed >= duration) {
              r();
              return;
            }

            // Draw current state
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            if (img) {
              const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
              ctx.drawImage(img, (WIDTH - img.width * scale) / 2, (HEIGHT - img.height * scale) / 2, img.width * scale, img.height * scale);
            }
            drawCaptions(seg.id, progress);
            
            requestAnimationFrame(frame);
          };
          frame();
        });
      };

      await renderScene();
    }

    // Small delay to ensure the MediaRecorder catches the last few frames properly
    setTimeout(() => mediaRecorder.stop(), 800);
  });
}
