
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
    const fontSize = Math.floor(h * 0.03);
    const startY = h * 0.75;
    return new Map(segments.map(s => [s.id, calculateTextLayout(ctx, s.narration, w * 0.85, startY, fontSize)]));
  }, [segments]);

  useEffect(() => {
    const toLoad = segments.filter(s => s.imageUrl && !imagesCache.current.has(s.imageUrl));
    if (toLoad.length === 0) return setIsReady(true);
    let loaded = 0;
    toLoad.forEach(seg => {
      const img = new Image();
      img.src = seg.imageUrl!;
      img.onload = () => { imagesCache.current.set(seg.imageUrl!, img); loaded++; if (loaded === toLoad.length) setIsReady(true); };
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
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    if (seg.imageUrl) {
      const img = imagesCache.current.get(seg.imageUrl);
      if (img) ctx.drawImage(img, 0, 0, w, h);
    }

    if (showCaptions && layout) {
      ctx.font = `bold ${layout.fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      const sidePadding = (w - (w * 0.85)) / 2;
      const activeWord = layout.flattenedWords.find(wd => progress >= wd.startTime && progress < wd.endTime);
      
      layout.lines.forEach(line => {
        line.words.forEach(word => {
          const isActive = word === activeWord;
          if (isActive) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath(); ctx.roundRect(sidePadding + word.x - 4, line.y - layout.fontSize * 0.65, word.width + 8, layout.fontSize * 1.3, 6); ctx.fill();
          }
          ctx.fillStyle = isActive ? '#000' : '#fff';
          ctx.fillText(word.text, sidePadding + word.x + word.width / 2, line.y);
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
    const loop = () => { draw(); if (isPlaying) rid = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(rid);
  }, [isPlaying, draw]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); } else { audioRef.current.pause(); setIsPlaying(false); }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative border-8 border-slate-800 rounded-[3rem] overflow-hidden bg-black aspect-[9/16] w-[320px]">
        <canvas ref={canvasRef} className="w-full h-full" />
        <audio ref={audioRef} src={segments[currentIndex]?.audioUrl} onEnded={() => currentIndex < segments.length - 1 ? setCurrentIndex(c => c + 1) : (setIsPlaying(false), setCurrentIndex(0))} />
      </div>
      <div className="flex gap-4">
        <Button onClick={() => {setCurrentIndex(0); if(audioRef.current){audioRef.current.currentTime=0;}}} variant="secondary" className="p-3 rounded-full"><RotateCcw size={20} /></Button>
        <Button onClick={toggle} variant="primary" className="px-8 rounded-full">{isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}</Button>
      </div>
    </div>
  );
};
