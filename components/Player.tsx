
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { GeneratedSegment } from '../types';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { calculateTextLayout, TextLayout } from '../utils/layout';

export const Player: React.FC<{ segments: GeneratedSegment[]; showCaptions?: boolean }> = ({ segments, showCaptions = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const imagesCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const layouts = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Map<string, TextLayout>();
    
    const h = 1920 / 2;
    const w = 1080 / 2;
    // Reduced Font Size: 5% of height is more standard for long sentences
    const fontSize = Math.floor(h * 0.05);
    
    return new Map(segments.map(s => [
      s.id, 
      calculateTextLayout(ctx, s.narration, w * 0.8, fontSize)
    ]));
  }, [segments]);

  useEffect(() => {
    const toLoad = segments.filter(s => s.imageUrl && !imagesCache.current.has(s.imageUrl));
    if (toLoad.length === 0) return setIsReady(true);
    let loaded = 0;
    toLoad.forEach(seg => {
      const img = new Image();
      img.src = seg.imageUrl!;
      img.onload = () => { imagesCache.current.set(seg.imageUrl!, img); loaded++; if (loaded === toLoad.length) setIsReady(true); };
      img.onerror = () => { loaded++; if (loaded === toLoad.length) setIsReady(true); };
    });
  }, [segments]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isReady) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const seg = segments[currentIndex];
    if (!seg) return;

    const layout = layouts.get(seg.id);
    const audio = audioRef.current;
    const progress = audio ? audio.currentTime / (seg.audioDuration || 1) : 0;

    ctx.save();
    ctx.scale(dpr, dpr);
    
    // 1. Draw Visuals
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (seg.imageUrl) {
      const img = imagesCache.current.get(seg.imageUrl);
      if (img) {
        const scale = Math.max(w / img.width, h / img.height);
        const x = (w - img.width * scale) / 2;
        const y = (h - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      }
    }

    // 2. Draw Captions
    if (showCaptions && layout) {
      ctx.font = `800 ${layout.fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle'; // Center baseline for better vertical balance
      
      const blockWidth = w * 0.8;
      const blockX = (w - blockWidth) / 2;
      // Positioned higher than before to leave space for other UI elements and prevent overlap
      const blockY = (h * 0.6) - (layout.totalHeight / 2);

      const activeWord = layout.flattenedWords.find(wd => progress >= wd.startTime && progress < wd.endTime);
      
      layout.lines.forEach(line => {
        line.words.forEach(word => {
          const x = blockX + word.x;
          const y = blockY + line.y;
          const isActive = word === activeWord;

          if (isActive) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 15;
            
            ctx.fillStyle = '#FACC15'; 
            const paddingX = layout.fontSize * 0.2;
            const paddingY = layout.fontSize * 0.1;
            ctx.beginPath();
            ctx.roundRect(x - paddingX, y - (layout.fontSize/2) - paddingY, word.width + (paddingX * 2), layout.fontSize + (paddingY * 2), 10);
            ctx.fill();
            
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000000';
            ctx.fillText(word.text, x + word.width / 2, y);
          } else {
            ctx.lineJoin = 'round';
            ctx.lineWidth = layout.fontSize * 0.2;
            ctx.strokeStyle = '#000000';
            ctx.strokeText(word.text, x + word.width / 2, y);
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(word.text, x + word.width / 2, y);
          }
        });
      });
    }
    ctx.restore();
  }, [currentIndex, segments, isReady, showCaptions, layouts]);

  useEffect(() => {
    if (canvasRef.current) {
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = (1080 / 2) * dpr;
      canvasRef.current.height = (1920 / 2) * dpr;
    }
  }, []);

  useEffect(() => {
    let rid: number;
    const loop = () => { draw(); rid = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(rid);
  }, [draw]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { 
      audioRef.current.play(); 
      setIsPlaying(true); 
    } else { 
      audioRef.current.pause(); 
      setIsPlaying(false); 
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-xs mx-auto">
      <div className="relative border-8 border-slate-900 rounded-[3rem] overflow-hidden bg-black aspect-[9/16] w-full shadow-2xl">
        <canvas ref={canvasRef} className="w-full h-full" />
        <audio 
          ref={audioRef} 
          src={segments[currentIndex]?.audioUrl} 
          onEnded={() => {
            if (currentIndex < segments.length - 1) {
              const nextIdx = currentIndex + 1;
              setCurrentIndex(nextIdx);
              // Small delay ensures the next source is loaded before playing
              requestAnimationFrame(() => {
                if (audioRef.current && isPlaying) audioRef.current.play().catch(() => {});
              });
            } else {
              setIsPlaying(false);
              setCurrentIndex(0);
            }
          }} 
        />
        {!isPlaying && isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <button onClick={toggle} className="bg-white/20 p-6 rounded-full backdrop-blur-md border border-white/20 hover:scale-110 active:scale-95 transition-all shadow-xl">
              <Play fill="white" className="text-white w-10 h-10 ml-1" />
            </button>
          </div>
        )}
      </div>
      <div className="flex gap-4">
        <Button onClick={() => {setCurrentIndex(0); if(audioRef.current){audioRef.current.currentTime=0; setIsPlaying(false); audioRef.current.pause();}}} variant="secondary" className="w-14 h-14 p-0 rounded-full"><RotateCcw size={20} /></Button>
        <Button onClick={toggle} variant="primary" className="h-14 px-12 rounded-full shadow-blue-500/20 active:translate-y-0.5">{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</Button>
      </div>
    </div>
  );
};
