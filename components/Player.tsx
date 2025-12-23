
import React, { useRef, useEffect, useState } from 'react';
import { GeneratedSegment } from '../types';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface PlayerProps {
  segments: GeneratedSegment[];
  isGenerating: boolean;
  showCaptions?: boolean;
}

export const Player: React.FC<PlayerProps> = ({ segments, isGenerating, showCaptions = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const imagesCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    let loaded = 0;
    const toLoad = segments.filter(s => s.imageUrl && !imagesCache.current.has(s.imageUrl));
    if (toLoad.length === 0) return setIsReady(true);

    toLoad.forEach(seg => {
      const img = new Image();
      img.src = seg.imageUrl!;
      img.onload = () => {
        imagesCache.current.set(seg.imageUrl!, img);
        loaded++;
        if (loaded === toLoad.length) setIsReady(true);
      };
    });
  }, [segments]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isReady) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = 1080 / 2; 
    const h = canvas.height = 1920 / 2;

    const render = () => {
      const seg = segments[currentIndex];
      const audio = audioRef.current;
      const elapsed = audio ? audio.currentTime : 0;
      const duration = seg?.audioDuration || 1;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      if (seg?.imageUrl) {
        const img = imagesCache.current.get(seg.imageUrl);
        if (img) ctx.drawImage(img, 0, 0, w, h);
      }

      if (showCaptions && seg?.narration) {
         // Relative Typography
         const fontSize = Math.floor(h * 0.035);
         ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         const words = seg.narration.split(' ');
         const totalChars = words.reduce((a, b) => a + b.length, 0);
         let cum = 0;
         let active = -1;
         for (let i = 0; i < words.length; i++) {
            const d = (words[i].length / totalChars) * duration;
            if (elapsed >= cum && elapsed < cum + d) { active = i; break; }
            cum += d;
         }

         const startY = h * 0.78;
         const lines: string[][] = [];
         let cur: string[] = [];
         words.forEach(wd => {
           if (ctx.measureText([...cur, wd].join(' ')).width > w * 0.85) { lines.push(cur); cur = [wd]; } else cur.push(wd);
         });
         lines.push(cur);

         let count = 0;
         lines.forEach((ln, idx) => {
           const y = startY + idx * (fontSize * 1.3);
           let x = (w - ctx.measureText(ln.join(' ')).width) / 2;
           ln.forEach(word => {
             const ww = ctx.measureText(word).width;
             if (count === active) {
               ctx.fillStyle = '#fbbf24';
               ctx.beginPath(); ctx.roundRect(x - 4, y - (fontSize * 0.65), ww + 8, fontSize * 1.3, 6); ctx.fill();
             }
             ctx.fillStyle = count === active ? '#000' : '#fff';
             ctx.fillText(word, x + ww / 2, y);
             x += ww + ctx.measureText(' ').width;
             count++;
           });
         });
      }
      requestRef.current = requestAnimationFrame(render);
    };
    requestRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [currentIndex, segments, isReady, showCaptions]);

  const togglePlay = () => {
    if (!audioRef.current || !isReady) return;
    if (audioRef.current.paused) {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
      <div className="relative border-8 border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl bg-black aspect-[9/16] w-full max-w-[320px]">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <audio 
          ref={audioRef} 
          src={segments[currentIndex]?.audioUrl} 
          onEnded={() => {
            if (currentIndex < segments.length - 1) setCurrentIndex(c => c + 1);
            else { setIsPlaying(false); setCurrentIndex(0); }
          }}
        />
      </div>
      <div className="flex gap-4">
        <Button onClick={() => setCurrentIndex(0)} variant="secondary" className="p-3 rounded-full"><RotateCcw size={20} /></Button>
        <Button onClick={togglePlay} variant="primary" className="px-8 rounded-full">
          {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {isPlaying ? "Pause" : "Play Preview"}
        </Button>
      </div>
    </div>
  );
};
