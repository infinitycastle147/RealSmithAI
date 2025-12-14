import React, { useRef, useEffect, useState } from 'react';
import { GeneratedSegment } from '../types';
import { Play, Pause, RotateCcw, Download } from 'lucide-react';
import { Button } from './Button';

interface PlayerProps {
  segments: GeneratedSegment[];
  isGenerating: boolean;
}

export const Player: React.FC<PlayerProps> = ({ segments, isGenerating }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  
  // To track loading of images
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const requestRef = useRef<number>();

  useEffect(() => {
    // Preload images
    let loadedCount = 0;
    const totalImages = segments.length;
    
    segments.forEach(seg => {
      if (seg.imageUrl && !imagesRef.current.has(seg.imageUrl)) {
        const img = new Image();
        img.src = seg.imageUrl;
        img.onload = () => {
          loadedCount++;
          if (loadedCount === totalImages) setIsReady(true);
        };
        imagesRef.current.set(seg.imageUrl, img);
      } else if (seg.imageUrl) {
        loadedCount++;
      }
    });

    if (totalImages > 0 && loadedCount === totalImages) {
      setIsReady(true);
    }
  }, [segments]);

  // Initial Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for Shorts (9:16)
    // We display it scaled down, but internal res should be high
    canvas.width = 1080 / 2; 
    canvas.height = 1920 / 2;

    const currentSegment = segments[currentIndex];
    if (currentSegment?.imageUrl) {
      const img = imagesRef.current.get(currentSegment.imageUrl);
      if (img) {
         drawImageCover(ctx, img, canvas.width, canvas.height);
      } else {
         // Placeholder
         ctx.fillStyle = '#1e293b';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = '#475569';
         ctx.font = '20px sans-serif';
         ctx.fillText("Loading Visuals...", 50, canvas.height/2);
      }
    } else {
         ctx.fillStyle = '#000';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Overlay Text (Captions)
    if (currentSegment?.narration) {
       drawCaptions(ctx, currentSegment.narration, canvas.width, canvas.height);
    }

  }, [currentIndex, segments, isReady]);

  // Audio Playback Handling
  useEffect(() => {
    if (!audioRef.current || !segments[currentIndex]?.audioUrl) return;

    const audio = audioRef.current;
    
    const handleEnded = () => {
      if (currentIndex < segments.length - 1) {
        setCurrentIndex(prev => prev + 1);
        // Auto play next
        setTimeout(() => {
             if (isPlaying && audioRef.current) {
                audioRef.current.play().catch(e => console.log("Autoplay blocked", e));
             }
        }, 100); 
      } else {
        setIsPlaying(false);
        setCurrentIndex(0); // Loop back or stop
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, segments, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
        if (isPlaying) {
             // Ensure src is set
             if (audioRef.current.src !== segments[currentIndex]?.audioUrl) {
                audioRef.current.src = segments[currentIndex]?.audioUrl || '';
             }
             audioRef.current.play().catch(() => setIsPlaying(false));
        } else {
            audioRef.current.pause();
        }
    }
  }, [isPlaying, currentIndex, segments]);

  const togglePlay = () => {
    if (!isReady || segments.length === 0) return;
    if (currentIndex === segments.length - 1 && !isPlaying && audioRef.current?.ended) {
        setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const drawImageCover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) => {
     // Draw image to cover the canvas (center crop)
     const r = w / h;
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
     
     ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  };

  const drawCaptions = (ctx: CanvasRenderingContext2D, text: string, w: number, h: number) => {
      // Simple caption styling
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      const fontSize = 24;
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      
      const words = text.split(' ');
      let line = '';
      const lines = [];
      const maxWidth = w * 0.8;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      // Draw background box for text
      const boxHeight = lines.length * (fontSize * 1.4) + 20;
      const boxY = h * 0.75 - 20;
      
      // ctx.fillRect(w * 0.05, boxY, w * 0.9, boxHeight);

      ctx.fillStyle = '#ffffff';
      // Text Shadow
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, h * 0.75 + (i * fontSize * 1.4));
      }
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
  };

  const handleDownload = () => {
    // NOTE: True video export (MP4) requires MediaRecorder API and playing through the whole sequence in real-time or using FFMPEG.
    // For this demo, we'll alert the user about the limitation or implement a basic real-time recorder if needed.
    // Here we will just record the playback if the user presses "Record & Download"
    alert("In a production app, this would trigger a server-side render or a client-side ffmpeg process. For now, please screen capture the preview!");
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      {/* Phone Frame */}
      <div className="relative border-8 border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl bg-black aspect-[9/16] w-full max-w-[320px]">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20"></div>
        
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-cover block"
        />
        
        {/* Loading Overlay */}
        {(!isReady || isGenerating) && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 text-white">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
             <p className="text-sm font-medium animate-pulse">{isGenerating ? 'Creating Magic...' : 'Loading Assets...'}</p>
          </div>
        )}

        <audio ref={audioRef} className="hidden" />
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        <Button onClick={() => setCurrentIndex(0)} variant="secondary" className="p-3 rounded-full" title="Restart">
           <RotateCcw size={20} />
        </Button>
        
        <Button 
          onClick={togglePlay} 
          variant="primary" 
          className="px-8 rounded-full"
          disabled={!isReady || isGenerating}
        >
          {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          {isPlaying ? "Pause" : "Play Preview"}
        </Button>

        <Button onClick={handleDownload} variant="secondary" className="p-3 rounded-full" title="Export Video">
           <Download size={20} />
        </Button>
      </div>
      
      <div className="text-slate-500 text-xs">
         Segment {currentIndex + 1} of {segments.length}
      </div>
    </div>
  );
};