import { GeneratedSegment } from "../types";

export async function renderVideo(
  segments: GeneratedSegment[], 
  onProgress: (status: string) => void
): Promise<string> {
  const canvas = document.createElement('canvas');
  // Set dimensions for YouTube Shorts (Vertical 1080p)
  // We use slightly lower resolution for performance during client-side rendering if needed, 
  // but let's try full HD.
  const WIDTH = 720; // 720p width
  const HEIGHT = 1280; // 720p height (9:16)
  
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Setup MediaRecorder
  const stream = canvas.captureStream(30); // 30 FPS
  const audioContext = new AudioContext();
  const dest = audioContext.createMediaStreamDestination();
  
  // Mix audio into the stream
  const mixedStream = new MediaStream([
    ...stream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  // Prefer VP9 for better quality/size, fallback to default
  let mimeType = 'video/webm;codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm'; // fallback
  }

  const mediaRecorder = new MediaRecorder(mixedStream, {
    mimeType,
    videoBitsPerSecond: 2500000 // 2.5 Mbps
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise(async (resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      audioContext.close();
      resolve(url);
    };

    mediaRecorder.start();

    // Helper to draw image cover
    const drawImage = (img: HTMLImageElement) => {
       const r = WIDTH / HEIGHT;
       const ir = img.width / img.height;
       let sw, sh, sx, sy;
       if (ir > r) {
          sh = img.height;
          sw = img.height * r;
          sx = (img.width - sw) / 2;
          sy = 0;
       } else {
          sw = img.width;
          sh = img.width / r;
          sx = 0;
          sy = (img.height - sh) / 2;
       }
       ctx.drawImage(img, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
    };

    // Helper to draw text
    const drawText = (text: string) => {
        // Overlay gradient
        const gradient = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, HEIGHT * 0.6, WIDTH, HEIGHT * 0.4);

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 36px Inter, sans-serif';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const words = text.split(' ');
        let line = '';
        let y = HEIGHT * 0.8;
        const maxWidth = WIDTH * 0.85;
        const lineHeight = 50;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, WIDTH / 2, y);
            line = words[n] + ' ';
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, WIDTH / 2, y);
        
        ctx.shadowColor = 'transparent';
    };

    // Preload images
    const images: HTMLImageElement[] = [];
    for (const seg of segments) {
        const img = new Image();
        img.src = seg.imageUrl || '';
        await new Promise(r => { img.onload = r; img.onerror = r; });
        images.push(img);
    }

    // Playback loop
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (!seg.audioUrl) continue;

        onProgress(`Rendering Scene ${i + 1}/${segments.length}`);

        // Fetch audio data
        const response = await fetch(seg.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Play Audio
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(dest);
        source.start();

        // Draw Loop for the duration of this segment
        const startTime = Date.now();
        const durationMs = audioBuffer.duration * 1000;
        
        // Animation loop for this segment
        await new Promise<void>(resolveSegment => {
            function animate() {
                const elapsed = Date.now() - startTime;
                
                // Draw current frame
                ctx!.fillStyle = '#000';
                ctx!.fillRect(0, 0, WIDTH, HEIGHT);
                
                if (images[i]) {
                    // Optional: Add slight zoom effect
                    // const scale = 1 + (elapsed / durationMs) * 0.05;
                    // ctx?.save();
                    // ctx?.translate(WIDTH/2, HEIGHT/2);
                    // ctx?.scale(scale, scale);
                    // ctx?.translate(-WIDTH/2, -HEIGHT/2);
                    drawImage(images[i]);
                    // ctx?.restore();
                }

                drawText(seg.narration);

                if (elapsed < durationMs) {
                    requestAnimationFrame(animate);
                } else {
                    resolveSegment();
                }
            }
            animate();
        });
    }

    mediaRecorder.stop();
  });
}