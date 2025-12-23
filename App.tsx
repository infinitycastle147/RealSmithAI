
import React, { useState, useEffect } from 'react';
import { Sparkles, Video, Wand2, Type as TypeIcon, Palette, Film, Download, RotateCcw, Clapperboard, ChevronRight, Check, Settings2, Mic, PencilLine, Trash2, Plus } from 'lucide-react';
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

const VOICES: VoiceName[] = ['Kore', 'Puck', 'Zephyr', 'Fenrir'];

export default function App() {
  const [step, setStep] = useState<AppStep>('INPUT');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const [project, setProject] = useState<ProjectState>({
    topic: '',
    style: VisualStyle.CHALKBOARD,
    voice: 'Kore',
    showCaptions: true,
    exportFormat: 'mp4',
    segments: []
  });

  // Track URLs to revoke them only on unmount or explicit reset to avoid NetworkErrors
  useEffect(() => {
    return () => {
      // Cleanup on unmount only
      if (project.finalVideoUrl) {
        URL.revokeObjectURL(project.finalVideoUrl);
      }
      project.segments.forEach(s => {
        if (s.audioUrl) URL.revokeObjectURL(s.audioUrl);
      });
    };
  }, []);

  const handleStartGeneration = async () => {
    setStep('GENERATION');
    
    // Revoke old video if it exists before creating a new one
    if (project.finalVideoUrl) {
      URL.revokeObjectURL(project.finalVideoUrl);
    }
    
    try {
        const segments = [...project.segments];
        for (let i = 0; i < segments.length; i++) {
            setLoadingMessage(`Preparing scene ${i + 1}/${segments.length}...`);
            
            // 1. Voice
            // If the text has changed or it's a new scene, we'll need to regenerate or verify.
            // Currently, logic simply checks if audioUrl exists.
            if (!segments[i].audioUrl) {
                const { audioUrl, duration } = await generateVoiceForSegment(segments[i].narration, project.voice);
                segments[i].audioUrl = audioUrl;
                segments[i].audioDuration = duration;
            }

            // 2. Image
            if (!segments[i].imageUrl) {
                 const styleStr = project.style === VisualStyle.CUSTOM ? (project.customStylePrompt || 'Modern Art') : project.style;
                 segments[i].imageUrl = await generateImageForSegment(segments[i].visualDescription, styleStr);
            }

            // Functional state update to avoid stale closures
            setProject(prev => {
              const updated = [...prev.segments];
              updated[i] = { ...segments[i] };
              return { ...prev, segments: updated };
            });
        }

        const { url, actualMime } = await renderVideo(segments, (m) => setLoadingMessage(m), {
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
        alert("Production failed. Please try again.");
        setStep('SCRIPT');
    }
  };

  const handleAddScene = () => {
    const newScene: GeneratedSegment = {
      id: `seg-${Date.now()}-${Math.random()}`,
      narration: '',
      visualDescription: '',
      isGenerating: false
    };
    setProject(prev => ({
      ...prev,
      segments: [...prev.segments, newScene]
    }));
  };

  const handleDeleteScene = (index: number) => {
    setProject(prev => {
      const sceneToDelete = prev.segments[index];
      if (sceneToDelete.audioUrl) {
        URL.revokeObjectURL(sceneToDelete.audioUrl);
      }
      const newSegments = prev.segments.filter((_, i) => i !== index);
      return {
        ...prev,
        segments: newSegments
      };
    });
  };

  const handleDownload = () => {
    if (project.finalVideoUrl) {
      const a = document.createElement('a');
      a.href = project.finalVideoUrl;
      a.download = `reelsmith-${Date.now()}.${project.exportFormat}`;
      a.click();
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'INPUT':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn">
             <div className="w-full max-w-3xl text-center space-y-10">
                <div className="space-y-4">
                  <h1 className="text-6xl md:text-8xl font-black text-white leading-tight">Create <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">Viral</span> Reels</h1>
                  <p className="text-slate-400 text-xl max-w-xl mx-auto">AI-powered scripting, voiceovers, and visual generation for YouTube Shorts.</p>
                </div>
                <div className="relative group max-w-2xl mx-auto">
                  <div className="absolute -inset-1 bg-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition"></div>
                  <div className="relative bg-slate-900 p-2 rounded-2xl flex border border-slate-700">
                    <input
                      maxLength={150}
                      value={project.topic}
                      onChange={(e) => setProject(p => ({ ...p, topic: e.target.value }))}
                      placeholder="Enter a topic (e.g., Space Exploration)"
                      className="w-full bg-transparent text-white p-4 outline-none text-lg"
                      onKeyDown={(e) => e.key === 'Enter' && project.topic && setStep('STYLE')}
                    />
                    <Button onClick={() => setStep('STYLE')} disabled={!project.topic.trim()} variant="glow">Next</Button>
                  </div>
                </div>
             </div>
          </div>
        );

      case 'STYLE':
        return (
          <div className="w-full max-w-5xl mx-auto animate-fadeIn pb-24">
            <h2 className="text-4xl font-bold text-white mb-8">Choose Direction</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
               {STYLE_PRESETS.map((s) => (
                 <button
                   key={s.id}
                   onClick={() => setProject(p => ({ ...p, style: s.id as VisualStyle }))}
                   className={`p-6 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-48 relative overflow-hidden group ${project.style === s.id ? 'border-blue-500 bg-slate-800' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                 >
                   <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                   <div className="relative z-10">
                     <h3 className="text-2xl font-bold text-white mb-2">{s.label}</h3>
                     <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                   </div>
                   {project.style === s.id && (
                     <div className="absolute top-4 right-4 text-blue-400">
                        <Check size={24} />
                     </div>
                   )}
                 </button>
               ))}
               
               <div
                 onClick={() => setProject(p => ({ ...p, style: VisualStyle.CUSTOM }))}
                 className={`p-6 rounded-2xl border-2 transition-all text-left flex flex-col justify-between h-48 cursor-pointer relative ${project.style === VisualStyle.CUSTOM ? 'border-purple-500 bg-slate-800' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
               >
                  <div className="relative z-10 w-full">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-2xl font-bold text-white">Custom Style</h3>
                      {project.style === VisualStyle.CUSTOM && <Check size={24} className="text-purple-400" />}
                    </div>
                    <p className="text-slate-400 text-sm mb-4">Describe your own unique aesthetic...</p>
                    
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <PencilLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text"
                        placeholder="e.g. Claymation, Oil Painting, 3D Render"
                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-purple-500 outline-none transition-colors"
                        value={project.customStylePrompt || ''}
                        onChange={(e) => setProject(p => ({ ...p, style: VisualStyle.CUSTOM, customStylePrompt: e.target.value }))}
                      />
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 flex flex-col md:flex-row gap-12 justify-between items-center">
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400"><Mic /></div>
                  <div>
                    <span className="block text-white font-bold">Narrator Voice</span>
                    <div className="flex gap-2 mt-2">
                      {VOICES.map(v => (
                        <button key={v} onClick={() => setProject(p => ({ ...p, voice: v }))} className={`px-3 py-1 rounded-lg text-xs font-bold transition ${project.voice === v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400"><TypeIcon /></div>
                  <div>
                    <span className="block text-white font-bold">Captions</span>
                    <button onClick={() => setProject(p => ({ ...p, showCaptions: !p.showCaptions }))} className={`mt-2 px-4 py-1.5 rounded-lg text-xs font-bold ${project.showCaptions ? 'bg-green-600' : 'bg-slate-800'}`}>{project.showCaptions ? 'Enabled' : 'Disabled'}</button>
                  </div>
                </div>
              </div>
              <Button onClick={async () => {
                setIsLoading(true);
                try {
                  const styleStr = project.style === VisualStyle.CUSTOM ? (project.customStylePrompt || 'Modern Art') : project.style;
                  const script = await generateScript(project.topic, styleStr);
                  setProject(p => ({ ...p, segments: script.map(s => ({ ...s, isGenerating: false })) }));
                  setStep('SCRIPT');
                } catch (e) {
                  alert("Failed to generate script.");
                } finally {
                  setIsLoading(false);
                }
              }} variant="glow" className="py-6 px-12 text-xl" isLoading={isLoading}>Generate Storyboard</Button>
            </div>
          </div>
        );

      case 'SCRIPT':
        return (
          <div className="w-full max-w-5xl mx-auto animate-fadeIn pb-32">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white">Review & Manage Scenes</h2>
              <Button onClick={handleAddScene} variant="outline" className="text-sm py-2 px-4">
                <Plus size={16} /> Add Scene
              </Button>
            </div>
            
            <div className="space-y-6">
              {project.segments.map((seg, i) => (
                <div key={seg.id} className="relative group bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-600">
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700 z-10">
                    {i + 1}
                  </div>
                  
                  <button 
                    onClick={() => handleDeleteScene(i)}
                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete Scene"
                  >
                    <Trash2 size={18} />
                  </button>

                  <div className="flex flex-col md:flex-row gap-6 mt-2">
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Mic size={12} /> Narration
                      </label>
                      <textarea 
                        value={seg.narration} 
                        placeholder="What should the AI say in this scene?"
                        onChange={(e) => {
                          const upd = [...project.segments]; 
                          upd[i].narration = e.target.value;
                          // If narration changes, we should clear existing audio to force regeneration
                          if (upd[i].audioUrl) {
                            URL.revokeObjectURL(upd[i].audioUrl!);
                            upd[i].audioUrl = undefined;
                          }
                          setProject(p => ({ ...p, segments: upd }));
                        }} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:border-blue-500 outline-none h-24 transition-colors resize-none" 
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Film size={12} /> Visual Description
                      </label>
                      <textarea 
                        value={seg.visualDescription} 
                        placeholder="What should the AI visualize?"
                        onChange={(e) => {
                          const upd = [...project.segments]; 
                          upd[i].visualDescription = e.target.value;
                          // If visual changes, clear image to force regeneration
                          upd[i].imageUrl = undefined;
                          setProject(p => ({ ...p, segments: upd }));
                        }} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-400 focus:border-purple-500 outline-none h-24 transition-colors resize-none" 
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {project.segments.length === 0 && (
                <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-3xl">
                  <p className="text-slate-500 mb-6">No scenes remaining. Add one to get started!</p>
                  <Button onClick={handleAddScene} variant="primary">
                    <Plus size={18} /> Add Your First Scene
                  </Button>
                </div>
              )}
            </div>

            <div className="fixed bottom-0 left-0 w-full p-6 bg-slate-950/80 backdrop-blur border-t border-slate-800 flex justify-center z-50">
              <div className="max-w-5xl w-full flex justify-between gap-4">
                <Button onClick={() => setStep('STYLE')} variant="ghost">Back to Styles</Button>
                <Button 
                  onClick={handleStartGeneration} 
                  variant="glow" 
                  disabled={project.segments.length === 0 || project.segments.some(s => !s.narration.trim())}
                  className="px-12 py-4 text-lg"
                >
                  Start Rendering Video
                </Button>
              </div>
            </div>
          </div>
        );

      case 'GENERATION':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-24 h-24 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-8"></div>
            <h2 className="text-3xl font-bold text-white mb-2">Rendering Your Short</h2>
            <p className="text-slate-400 animate-pulse">{loadingMessage}</p>
          </div>
        );

      case 'RESULT':
        return (
          <div className="w-full max-w-6xl mx-auto animate-fadeIn flex flex-col items-center">
            <h2 className="text-4xl font-bold text-white mb-12">Production Finished</h2>
            <div className="flex flex-col lg:flex-row gap-12 w-full justify-center items-center">
               <div className="bg-black rounded-[2rem] border-8 border-slate-900 overflow-hidden shadow-2xl max-w-[320px]">
                 <video src={project.finalVideoUrl} controls autoPlay className="aspect-[9/16] w-full" />
               </div>
               <div className="space-y-4 w-full lg:w-96">
                 <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                   <h3 className="text-white font-bold mb-4">Export Summary</h3>
                   <div className="space-y-2 text-sm">
                     <p className="text-slate-500">Format: <span className="text-slate-200">{project.exportFormat.toUpperCase()}</span></p>
                     <p className="text-slate-500">Resolution: <span className="text-slate-200">720x1280 (9:16)</span></p>
                   </div>
                   <Button onClick={handleDownload} variant="glow" className="w-full mt-8 py-4"><Download /> Download Video</Button>
                   <Button onClick={() => window.location.reload()} variant="outline" className="w-full mt-4"><RotateCcw /> Create New</Button>
                 </div>
               </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen text-slate-200">
      <nav className="p-6 border-b border-slate-800/50 flex justify-between items-center glass sticky top-0 z-50">
        <div className="flex items-center gap-2 font-black text-2xl tracking-tighter text-white">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"><Clapperboard size={20}/></div>
          ReelSmith AI
        </div>
        {step !== 'INPUT' && <StepIndicator currentStep={step} />}
      </nav>
      <main className="p-8">{renderContent()}</main>
    </div>
  );
}
