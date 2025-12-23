
import { GeneratedSegment } from "../types";

export async function renderVideo(
  segments: GeneratedSegment[], 
  onProgress: (status: string) => void,
  options: { showCaptions?: boolean; format?: 'webm' | 'mp4' } = {}
): Promise<{ url: string; actualMime: string }> {
  const { showCaptions = true, format = 'mp4' } = options;
  const canvas = document.createElement('canvas');
  const WIDTH = 720;
  const HEIGHT = 1280;
  
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas context failed");

  const stream = canvas.captureStream(30);
  const audioContext = new AudioContext();
  
  // CRITICAL: Handle browser autoplay policy
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const dest = audioContext.createMediaStreamDestination();
  const mixedStream = new MediaStream([
    ...stream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  let mimeType = '';
  const mp4Types = ['video/mp4;codecs=avc1', 'video/mp4'];
  const webmTypes = ['video/webm;codecs=vp9', 'video/webm'];

  if (format === 'mp4') {
    mimeType = mp4Types.find(t => MediaRecorder.isTypeSupported(t)) || webmTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
  } else {
    mimeType = webmTypes.find(t => MediaRecorder.isTypeSupported(t)) || mp4Types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  const mediaRecorder = new MediaRecorder(mixedStream, {
    mimeType,
    videoBitsPerSecond: 6000000 // Higher bitrate for quality
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      audioContext.close();
      resolve({ url, actualMime: mimeType });
    };

    mediaRecorder.start();

    const drawText = (text: string, elapsedS: number, totalS: number) => {
        if (!showCaptions) return;
        
        // Relative Typography
        const fontSize = Math.floor(HEIGHT * 0.035);
        ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const words = text.split(' ');
        const totalChars = words.reduce((acc, w) => acc + w.length, 0);
        let cumulativeS = 0;
        let activeIdx = -1;

        for (let i = 0; i < words.length; i++) {
           const wordDur = (words[i].length / totalChars) * totalS;
           if (elapsedS >= cumulativeS && elapsedS < cumulativeS + wordDur) {
              activeIdx = i;
              break;
           }
           cumulativeS += wordDur;
        }

        const maxWidth = WIDTH * 0.85;
        const lines: string[][] = [];
        let currentLine: string[] = [];
        words.forEach(word => {
          if (ctx.measureText([...currentLine, word].join(' ')).width > maxWidth) {
            lines.push(currentLine);
            currentLine = [word];
          } else {
            currentLine.push(word);
          }
        });
        lines.push(currentLine);

        let wordCounter = 0;
        const startY = HEIGHT * 0.8;
        const lineHeight = fontSize * 1.35;
        
        lines.forEach((line, lineIdx) => {
          const y = startY + (lineIdx * lineHeight);
          const lineWidth = ctx.measureText(line.join(' ')).width;
          let x = (WIDTH - lineWidth) / 2;

          line.forEach(word => {
            const wordWidth = ctx.measureText(word).width;
            const isActive = wordCounter === activeIdx;
            if (isActive) {
               ctx.save();
               ctx.fillStyle = '#fbbf24'; 
               ctx.beginPath();
               ctx.roundRect(x - 6, y - lineHeight/2, wordWidth + 12, lineHeight, 8);
               ctx.fill();
               ctx.restore();
            }
            ctx.fillStyle = isActive ? '#000' : '#fff';
            ctx.fillText(word, x + wordWidth / 2, y);
            x += wordWidth + ctx.measureText(' ').width;
            wordCounter++;
          });
        });
    };

    const images: HTMLImageElement[] = [];
    for (const seg of segments) {
        const img = new Image();
        img.src = seg.imageUrl || '';
        await new Promise(r => { img.onload = r; img.onerror = r; });
        images.push(img);
    }

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg.audioUrl) continue;
        onProgress(`Finalizing Scene ${i + 1}/${segments.length}`);
        const response = await fetch(seg.audioUrl);
        const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(dest);
        source.start();

        const startTime = Date.now();
        const durationMs = audioBuffer.duration * 1000;
        await new Promise<void>(res => {
            const anim = () => {
                const elapsed = Date.now() - startTime;
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, WIDTH, HEIGHT);
                if (images[i]) ctx.drawImage(images[i], 0, 0, WIDTH, HEIGHT);
                drawText(seg.narration, elapsed / 1000, audioBuffer.duration);
                if (elapsed < durationMs) requestAnimationFrame(anim); else res();
            };
            anim();
        });
    }
    mediaRecorder.stop();
  });
}
