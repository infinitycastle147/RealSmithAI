
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Video, Wand2, Type as TypeIcon, Palette, Film, Download, RotateCcw, Clapperboard, ChevronRight, Check, Settings2, Mic, PencilLine, Trash2, Plus, ExternalLink, Globe, Search } from 'lucide-react';
import { Button } from './components/Button';
import { StepIndicator } from './components/StepIndicator';
import { generateScript, generateImageForSegment, generateVoiceForSegment } from './services/gemini';
import { renderVideo } from './utils/videoGenerator';
import { AppStep, VisualStyle, ProjectState, VoiceName, GeneratedSegment } from './types';

const STYLE_PRESETS = [
  { id: VisualStyle.CHALKBOARD, label: 'Chalkboard', desc: 'Hand-sketched aesthetic', color: 'from-emerald-800 to-emerald-950' },
  { id: VisualStyle.ANIME, label: 'Anime', desc: 'Vibrant character-driven', color: 'from-indigo-600 to-purple-800' },
  { id: VisualStyle.CYBERPUNK, label: 'Cyberpunk', desc: 'Neon futuristic sci-fi', color: 'from-fuchsia-700 to-purple-900' },
  { id: VisualStyle.REALISTIC, label: 'Realistic', desc: 'High-fidelity cinematic', color: 'from-slate-700 to-slate-900' },
];

const VOICES: VoiceName[] = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

const SceneCard = React.memo(({ 
  segment, 
  index, 
  onUpdate, 
  onDelete 
}: { 
  segment: GeneratedSegment, 
  index: number, 
  onUpdate: (id: string, narration: string, visual: string) => void, 
  onDelete: (index: number) => void 
}) => {
  const [localNarration, setLocalNarration] = useState(segment.narration);
  const [localVisual, setLocalVisual] = useState(segment.visualDescription);
  const debounceTimer = useRef<number | null>(null);

  useEffect(() => {
    setLocalNarration(segment.narration);
    setLocalVisual(segment.visualDescription);
  }, [segment.id]);

  const handleChange = (nar: string, vis: string) => {
    setLocalNarration(nar);
    setLocalVisual(vis);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => onUpdate(segment.id, nar, vis), 500);
  };

  return (
    <div className="relative group bg-slate-900/40 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-600 hover:bg-slate-900/60 shadow-xl">
      <div className="absolute -top-3 -left-3 w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-sm font-bold text-white border-2 border-slate-950 z-10 shadow-lg">
        {index + 1}
      </div>
      <button 
        onClick={() => onDelete(index)} 
        className="absolute top-4 right-4 p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
        title="Remove Scene"
      >
        <Trash2 size={18} />
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Mic size={14} className="text-blue-400" /> Narration Script
          </label>
          <textarea 
            value={localNarration} 
            onChange={(e) => handleChange(e.target.value, localVisual)} 
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-white text-sm leading-relaxed h-32 resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-700" 
            placeholder="What will the narrator say in this scene?"
          />
        </div>
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Film size={14} className="text-purple-400" /> Visual Prompt
          </label>
          <textarea 
            value={localVisual} 
            onChange={(e) => handleChange(localNarration, e.target.value)} 
            className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm leading-relaxed h-32 resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-700" 
            placeholder="Describe the image to generate for this scene..."
          />
        </div>
      </div>
    </div>
  );
});

export default function App() {
  const [step, setStep] = useState<AppStep>('INPUT');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [groundingSources, setGroundingSources] = useState<any[]>([]);
  const [project, setProject] = useState<ProjectState>({
    topic: '', 
    style: VisualStyle.CHALKBOARD, 
    voice: 'Kore', 
    showCaptions: true, 
    exportFormat: 'mp4', 
    segments: []
  });

  const revokeAsset = (url?: string) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      revokeAsset(project.finalVideoUrl);
      project.segments.forEach(s => revokeAsset(s.audioUrl));
    };
  }, []);

  const handleStartGeneration = async () => {
    setStep('GENERATION');
    setLoadingMessage("Initiating production...");
    revokeAsset(project.finalVideoUrl);
    
    try {
      const styleStr = project.style === VisualStyle.CUSTOM ? (project.customStylePrompt || 'Modern Art') : project.style;
      const CONCURRENCY_LIMIT = 3;
      const queue = [...project.segments];
      const finalSegments: GeneratedSegment[] = [];
      let completed = 0;

      const processNext = async () => {
        if (queue.length === 0) return;
        const segment = queue.shift()!;
        
        const [voiceRes, imageRes] = await Promise.all([
          segment.audioUrl && segment.audioBuffer 
            ? Promise.resolve({ audioUrl: segment.audioUrl, duration: segment.audioDuration!, buffer: segment.audioBuffer! }) 
            : generateVoiceForSegment(segment.narration, project.voice),
          segment.imageUrl 
            ? Promise.resolve(segment.imageUrl) 
            : generateImageForSegment(segment.visualDescription, styleStr)
        ]);
        
        completed++;
        setLoadingMessage(`Assets: ${completed}/${project.segments.length}...`);
        
        finalSegments.push({ 
          ...segment, 
          audioUrl: voiceRes.audioUrl, 
          audioDuration: voiceRes.duration, 
          audioBuffer: voiceRes.buffer, 
          imageUrl: imageRes 
        });
        
        await processNext();
      };

      await Promise.all(Array.from({ length: CONCURRENCY_LIMIT }).map(() => processNext()));
      
      const sorted = finalSegments.sort((a, b) => {
        const indexA = project.segments.findIndex(s => s.id === a.id);
        const indexB = project.segments.findIndex(s => s.id === b.id);
        return indexA - indexB;
      });

      setProject(prev => ({ ...prev, segments: sorted }));

      setLoadingMessage("Assembling final video...");
      const { url, actualMime } = await renderVideo(sorted, (m) => setLoadingMessage(m), { 
        showCaptions: project.showCaptions, 
        format: project.exportFormat 
      });
      
      setProject(prev => ({ 
        ...prev, 
        finalVideoUrl: url, 
        exportFormat: actualMime.includes('mp4') ? 'mp4' : 'webm' 
      }));
      setStep('RESULT');
    } catch (e) {
      console.error(e);
      alert("Production failed. Returning to script editor.");
      setStep('SCRIPT');
    }
  };

  const handleUpdateScene = useCallback((id: string, narration: string, visual: string) => {
    setProject(prev => ({
      ...prev,
      segments: prev.segments.map(s => {
        if (s.id !== id) return s;
        const updated = { ...s, narration, visualDescription: visual };
        if (s.narration !== narration) { 
          revokeAsset(s.audioUrl); 
          updated.audioUrl = undefined; 
          updated.audioBuffer = undefined; 
        }
        if (s.visualDescription !== visual) {
          updated.imageUrl = undefined;
        }
        return updated;
      })
    }));
  }, []);

  const handleAddScene = useCallback(() => {
    setProject(prev => ({ 
      ...prev, 
      segments: [...prev.segments, { id: `seg-${Date.now()}-${Math.random()}`, narration: '', visualDescription: '', isGenerating: false }] 
    }));
  }, []);

  const handleDeleteScene = useCallback((index: number) => {
    setProject(prev => {
      revokeAsset(prev.segments[index].audioUrl);
      return { ...prev, segments: prev.segments.filter((_, i) => i !== index) };
    });
  }, []);

  return (
    <div className="min-h-screen text-slate-200 selection:bg-blue-500/30">
      <nav className="px-6 py-4 border-b border-white/5 flex justify-between items-center glass sticky top-0 z-50">
        <div className="flex items-center gap-3 font-black text-2xl tracking-tighter text-white cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.location.reload()}>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Clapperboard size={20} className="text-white" />
          </div>
          <span className="hidden sm:inline">ReelSmith AI</span>
        </div>
        {step !== 'INPUT' && (
          <div className="flex-1 max-w-xl px-8">
            <StepIndicator currentStep={step} />
          </div>
        )}
        <div className="w-10 sm:w-32 flex justify-end">
           <Button variant="ghost" className="p-2 sm:px-4" onClick={() => window.open('https://github.com', '_blank')}>
              <Globe size={20} className="sm:mr-2" />
              <span className="hidden sm:inline">Docs</span>
           </Button>
        </div>
      </nav>
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {step === 'INPUT' && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fadeIn text-center">
            <div className="w-full max-w-4xl space-y-12">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                  <Sparkles size={14} /> AI Video Production
                </div>
                <h1 className="text-6xl md:text-8xl font-black text-white leading-[1.1] tracking-tight">
                  Turn Ideas into <br />
                  <span className="bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 bg-clip-text text-transparent">Viral Shorts</span>
                </h1>
                <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
                  Experience the future of content creation. Grounded AI scripting, professional voiceovers, and cinematic visuals—all generated in seconds.
                </p>
              </div>

              <div className="bg-slate-900/40 backdrop-blur-xl p-3 rounded-[2.5rem] flex flex-col sm:flex-row border border-white/10 max-w-2xl mx-auto group focus-within:border-blue-500/50 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-2xl">
                <input 
                  value={project.topic} 
                  onChange={(e) => setProject(p => ({ ...p, topic: e.target.value }))} 
                  placeholder="What's your story? (e.g. Life of Steve Jobs)" 
                  className="w-full bg-transparent px-6 py-5 outline-none text-xl text-white placeholder:text-slate-600 font-medium" 
                  onKeyDown={(e) => e.key === 'Enter' && project.topic && setStep('STYLE')} 
                />
                <Button 
                  onClick={() => setStep('STYLE')} 
                  disabled={!project.topic.trim()} 
                  variant="glow"
                  className="sm:w-48 py-5 rounded-[2rem] text-lg font-bold"
                >
                  Create Now
                </Button>
              </div>
              
              <div className="flex items-center justify-center gap-8 text-slate-500 text-sm font-medium pt-8">
                 <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500"/> Fact-checked</div>
                 <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500"/> Vertical 9:16</div>
                 <div className="flex items-center gap-2"><Check size={16} className="text-emerald-500"/> No Editing Required</div>
              </div>
            </div>
          </div>
        )}

        {step === 'STYLE' && (
          <div className="w-full max-w-5xl mx-auto animate-fadeIn pb-24">
            <header className="mb-12 space-y-2">
              <h2 className="text-4xl font-black text-white">Visual Aesthetic</h2>
              <p className="text-slate-400">Select the visual direction for your production.</p>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {STYLE_PRESETS.map(s => (
                <button 
                  key={s.id} 
                  onClick={() => setProject(p => ({ ...p, style: s.id as VisualStyle }))} 
                  className={`group p-6 rounded-3xl border-2 text-left transition-all relative overflow-hidden h-52 flex flex-col justify-end
                    ${project.style === s.id 
                      ? 'border-blue-500 bg-slate-800 shadow-2xl shadow-blue-500/10' 
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'}`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-t ${s.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white mb-1">{s.label}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                  {project.style === s.id && (
                    <div className="absolute top-4 right-4 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                      <Check className="text-white" size={16} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="glass rounded-[3rem] p-10 border border-white/5 flex flex-col lg:flex-row gap-12 items-center justify-between shadow-2xl">
              <div className="space-y-8 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Mic size={14} className="text-blue-500" /> Narrative Voice</label>
                    <div className="flex flex-wrap gap-2">
                      {VOICES.map(v => (
                        <button 
                          key={v} 
                          onClick={() => setProject(p => ({ ...p, voice: v }))} 
                          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all border
                            ${project.voice === v 
                              ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40 scale-105' 
                              : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'}`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><Palette size={14} className="text-purple-500" /> Custom Instruction</label>
                    <div className={`relative transition-all ${project.style === VisualStyle.CUSTOM ? 'opacity-100' : 'opacity-40 cursor-not-allowed'}`}>
                      <PencilLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text"
                        disabled={project.style !== VisualStyle.CUSTOM}
                        placeholder="e.g. Cinematic 3D, Cyber-Noir..."
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-sm text-white focus:border-purple-500 outline-none transition-all"
                        value={project.customStylePrompt || ''}
                        onChange={(e) => setProject(p => ({ ...p, style: VisualStyle.CUSTOM, customStylePrompt: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 w-full lg:w-auto">
                <Button 
                  onClick={async () => {
                    setIsLoading(true);
                    setLoadingMessage("AI Researching topic...");
                    try {
                      const styleStr = project.style === VisualStyle.CUSTOM ? (project.customStylePrompt || 'Modern Art') : project.style;
                      const result = await generateScript(project.topic, styleStr);
                      setProject(p => ({ ...p, segments: result.segments.map(s => ({ ...s, isGenerating: false })) }));
                      setGroundingSources(result.sources);
                      setStep('SCRIPT');
                    } catch (e) {
                      alert("Failed to generate script.");
                    } finally {
                      setIsLoading(false);
                    }
                  }} 
                  variant="glow" 
                  className="w-full lg:w-auto px-12 py-7 text-xl rounded-2xl" 
                  isLoading={isLoading}
                >
                  {isLoading ? loadingMessage : "Initialize Production"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'SCRIPT' && (
          <div className="w-full max-w-4xl mx-auto animate-fadeIn pb-32">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
              <div className="space-y-1">
                <h2 className="text-4xl font-black text-white">Review Storyboard</h2>
                <p className="text-slate-400">AI has drafted your 60-second production. Refine segments as needed.</p>
              </div>
              <Button onClick={handleAddScene} variant="outline" className="text-sm px-6 py-3 rounded-xl border-white/5 bg-white/5 hover:bg-white/10">
                <Plus size={18} /> Add Scene
              </Button>
            </header>

            <div className="space-y-8">
              {project.segments.map((seg, i) => (
                <SceneCard key={seg.id} segment={seg} index={i} onUpdate={handleUpdateScene} onDelete={handleDeleteScene} />
              ))}
            </div>

            <div className="fixed bottom-0 left-0 w-full p-8 bg-slate-950/90 backdrop-blur-2xl border-t border-white/5 flex justify-center z-50">
              <div className="max-w-4xl w-full flex items-center justify-between gap-6">
                <Button onClick={() => setStep('STYLE')} variant="ghost" className="text-slate-400">Back</Button>
                <Button 
                  onClick={handleStartGeneration} 
                  variant="glow" 
                  disabled={project.segments.length === 0 || project.segments.some(s => !s.narration.trim())}
                  className="flex-1 sm:flex-none px-16 py-5 text-lg rounded-2xl shadow-blue-500/20"
                >
                  Confirm & Render Video
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 'GENERATION' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center">
            <div className="relative w-32 h-32">
               <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
               <div className="absolute inset-0 border-t-4 border-blue-500 rounded-full animate-spin"></div>
               <div className="absolute inset-4 bg-blue-500/5 rounded-full flex items-center justify-center">
                  <Clapperboard className="text-blue-500 animate-pulse" size={40} />
               </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white tracking-tight">Rendering Masterpiece</h2>
              <p className="text-slate-400 font-medium text-lg animate-pulse">{loadingMessage}</p>
            </div>
            <div className="max-w-md bg-slate-900/50 p-6 rounded-3xl border border-white/5 text-sm text-slate-500 leading-relaxed">
              Our AI is currently synthesizing voices and generating cinematic visuals based on your script. High-quality production takes a few moments.
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="w-full max-w-6xl mx-auto animate-fadeIn pb-24">
            <header className="text-center mb-16 space-y-4">
              <h2 className="text-5xl font-black text-white tracking-tight">Production Complete</h2>
              <p className="text-slate-400 text-lg">Your high-fidelity short is ready for distribution.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
              <div className="lg:col-span-5 flex justify-center lg:justify-end lg:sticky lg:top-32">
                <div className="relative group">
                   <div className="absolute -inset-4 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                   <div className="relative bg-black rounded-[2.5rem] border-[12px] border-slate-900 overflow-hidden shadow-2xl max-w-[340px] w-full aspect-[9/16]">
                    <video src={project.finalVideoUrl} controls autoPlay className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-7 space-y-8">
                <div className="glass rounded-[2.5rem] p-10 border border-white/5 space-y-8 shadow-2xl bg-slate-900/40">
                  <div className="flex items-center gap-4 border-b border-white/5 pb-8">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                      <Settings2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Export Success</h3>
                      <p className="text-slate-500 text-sm">Optimized for YouTube & TikTok</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Button 
                      onClick={() => {
                        if (project.finalVideoUrl) {
                          const a = document.createElement('a');
                          a.href = project.finalVideoUrl;
                          a.download = `reelsmith-${Date.now()}.${project.exportFormat}`;
                          a.click();
                        }
                      }} 
                      variant="glow" 
                      className="py-5 text-lg font-bold rounded-2xl"
                    >
                      <Download size={20} /> Download MP4
                    </Button>
                    <Button onClick={() => window.location.reload()} variant="secondary" className="py-5 text-lg font-bold rounded-2xl border-white/5 bg-white/5 hover:bg-white/10">
                      <RotateCcw size={20} /> New Project
                    </Button>
                  </div>
                </div>

                {groundingSources.length > 0 && (
                  <div className="bg-slate-900/20 rounded-[2.5rem] p-10 border border-white/5 shadow-xl">
                    <div className="flex items-center gap-2 mb-8">
                       <Search size={18} className="text-blue-400" />
                       <h4 className="text-slate-300 font-black text-sm uppercase tracking-[0.2em]">Fact-Check Research</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {groundingSources.map((chunk, idx) => (
                        chunk.web && (
                          <a 
                            key={idx}
                            href={chunk.web.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 bg-slate-950/40 border border-white/5 rounded-2xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                          >
                            <div className="flex flex-col gap-0.5 min-w-0 pr-4">
                              <span className="text-slate-200 text-sm font-bold truncate">{chunk.web.title || "Untitled Research"}</span>
                              <span className="text-slate-500 text-xs truncate opacity-60 font-mono tracking-tighter">{chunk.web.uri}</span>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-500 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-colors shrink-0">
                               <ExternalLink size={14} />
                            </div>
                          </a>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-auto py-12 px-6 border-t border-white/5 bg-slate-950/50">
         <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-8 opacity-40">
            <div className="flex items-center gap-2 font-black text-lg tracking-tighter">
               <Clapperboard size={16} /> ReelSmith
            </div>
            <div className="text-xs font-bold tracking-widest uppercase flex gap-8">
               <a href="#" className="hover:text-white transition-colors">Privacy</a>
               <a href="#" className="hover:text-white transition-colors">Terms</a>
               <a href="#" className="hover:text-white transition-colors">Enterprise</a>
            </div>
            <div className="text-xs">© 2025 AI Production Engine.</div>
         </div>
      </footer>
    </div>
  );
}
