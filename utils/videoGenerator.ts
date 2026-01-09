
import { CaptionStyle, GeneratedSegment } from "../types";
import { calculateTextLayout, TextLayout } from "./layout";

/**
 * Optimized Video Renderer.
 * Uses a Master Clock architecture: Audio is scheduled on a single timeline to prevent gaps,
 * and the visual loop synchronizes to the audio context time.
 */
export async function renderVideo(
  segments: GeneratedSegment[], 
  onProgress: (status: string) => void,
  options: { showCaptions?: boolean; captionStyle?: CaptionStyle; format?: 'webm' | 'mp4' } = {}
): Promise<{ url: string; actualMime: string }> {
  const { showCaptions = true, captionStyle = CaptionStyle.SENTENCE, format = 'mp4' } = options;
  const WIDTH = 720; 
  const HEIGHT = 1280;
  
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas context failed");

  // Font Size standardized to 3.5% of HEIGHT
  const fontSize = Math.floor(HEIGHT * 0.035);
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Create context and handle suspension state which causes silent videos
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const dest = audioContext.createMediaStreamDestination();
  
  const canvasStream = canvas.captureStream(30); // 30 FPS
  const mixedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  // Prioritize codecs that are widely supported
  const types = format === 'mp4' 
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'] 
    : ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
    
  const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  if (!mimeType) throw new Error("No supported mime type found for recording");

  const mediaRecorder = new MediaRecorder(mixedStream, { 
    mimeType, 
    videoBitsPerSecond: 8000000 // 8 Mbps
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

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

  // --- Calculate Timeline ---
  // We map every segment to a specific start/end time on a global timeline.
  let globalCursor = 0;
  const timeline = segments.map((seg, index) => {
    const duration = seg.audioDuration || 0;
    const start = globalCursor;
    globalCursor += duration;
    return {
      ...seg,
      img: images[index],
      timelineStart: start,
      timelineEnd: globalCursor,
      duration
    };
  });
  const TOTAL_DURATION = globalCursor;

  return new Promise(async (resolve, reject) => {
    let isFinished = false;

    const cleanup = () => {
      if (!isFinished) {
        audioContext.close();
        isFinished = true;
      }
    };

    mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        cleanup();
        reject(e);
    };

    mediaRecorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      resolve({ url, actualMime: mimeType });
    };

    try {
        mediaRecorder.start();
    } catch(e) {
        cleanup();
        reject(new Error("Failed to start MediaRecorder: " + e));
        return;
    }

    // --- Schedule Audio (Gapless) ---
    // We schedule ALL audio segments upfront relative to the context time.
    // This allows the Web Audio API to handle gapless transitions perfectly.
    const audioStartTime = audioContext.currentTime + 0.1; // 100ms buffer to ensure smooth start
    
    timeline.forEach(item => {
        if (item.audioBuffer) {
            const source = audioContext.createBufferSource();
            source.buffer = item.audioBuffer;
            source.connect(dest);
            source.start(audioStartTime + item.timelineStart);
        }
    });

    // --- Render Loop (Synced to Audio Clock) ---
    
    const drawFrame = () => {
        if (isFinished) return;

        // The master clock is the AudioContext time
        const elapsed = audioContext.currentTime - audioStartTime;
        
        // Find which segment is active at this exact moment
        const activeSegment = timeline.find(t => elapsed >= t.timelineStart && elapsed < t.timelineEnd);

        // Clear Screen
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        if (activeSegment) {
            // Draw Visual
            const img = activeSegment.img;
            if (img) {
                const scale = Math.max(WIDTH / img.width, HEIGHT / img.height);
                // Simple Ken Burns effect (slow zoom) based on segment progress
                const segProgress = (elapsed - activeSegment.timelineStart) / activeSegment.duration;
                const zoom = 1 + (segProgress * 0.05); // 5% zoom
                
                ctx.save();
                ctx.translate(WIDTH/2, HEIGHT/2);
                ctx.scale(zoom, zoom);
                ctx.translate(-WIDTH/2, -HEIGHT/2);
                ctx.drawImage(img, (WIDTH - img.width * scale) / 2, (HEIGHT - img.height * scale) / 2, img.width * scale, img.height * scale);
                ctx.restore();
            }

            // Draw Captions
            if (showCaptions) {
                const layout = layoutCache.get(activeSegment.id);
                if (layout) {
                    const segProgress = (elapsed - activeSegment.timelineStart) / activeSegment.duration;
                    renderCaptions(ctx, layout, segProgress, captionStyle, WIDTH, HEIGHT);
                }
            }
        } else if (elapsed < TOTAL_DURATION) {
             // If we are in a tiny gap (floating point math), draw the previous or next frame to avoid black flickers
             // but usually 'find' covers it. 
        }

        onProgress(`Rendering ${(Math.min(elapsed / TOTAL_DURATION, 1) * 100).toFixed(0)}%`);

        if (elapsed >= TOTAL_DURATION) {
            // Stop strictly when audio ends
            if (mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        } else {
            requestAnimationFrame(drawFrame);
        }
    };

    drawFrame();
  });
}

/**
 * Extracted Caption Renderer to keep main logic clean
 */
function renderCaptions(
    ctx: CanvasRenderingContext2D, 
    layout: TextLayout, 
    progress: number, 
    style: CaptionStyle,
    width: number, 
    height: number
) {
    if (style === CaptionStyle.WORD_BY_WORD) {
        // --- Viral Word-by-Word Style ---
        const activeWordIndex = layout.flattenedWords.findIndex(wd => progress >= wd.startTime && progress < wd.endTime);
        const activeWord = layout.flattenedWords[activeWordIndex];

        if (activeWord) {
            ctx.save();
            const bigFontSize = Math.floor(height * 0.08); 
            ctx.font = `900 ${bigFontSize}px "Plus Jakarta Sans", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const cx = width / 2;
            const cy = height / 2;

            // Deterministic styling
            const rotationSeed = (activeWordIndex * 1337) % 10; 
            const rotationAngle = (rotationSeed - 5) * (Math.PI / 180); 
            
            const colors = ['#FACC15', '#4ADE80', '#22D3EE', '#F472B6', '#FB923C'];
            const color = colors[activeWordIndex % colors.length];

            ctx.translate(cx, cy);
            ctx.rotate(rotationAngle);

            // Stroke
            ctx.lineJoin = 'round';
            ctx.lineWidth = bigFontSize * 0.2;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(activeWord.text, 0, 0);

            // Shadow
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;
            
            // Fill
            ctx.fillStyle = color;
            ctx.fillText(activeWord.text, 0, 0);
            
            ctx.restore();
        }
    } else {
        // --- Classic Sentence Style ---
        const fontSize = layout.fontSize;
        ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const blockWidth = width * 0.8;
        const blockX = (width - blockWidth) / 2;
        const blockY = (height * 0.6) - (layout.totalHeight / 2);
        
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
    }
}
