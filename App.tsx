import React, { useState } from 'react';
import { Sparkles, Video, Wand2, Type as TypeIcon, Palette, Film, Download, RotateCcw, Clapperboard, ChevronRight } from 'lucide-react';
import { Button } from './components/Button';
import { StepIndicator } from './components/StepIndicator';
import { generateScript, generateImageForSegment, generateVoiceForSegment } from './services/gemini';
import { renderVideo } from './utils/videoGenerator';
import { AppStep, VisualStyle, ProjectState } from './types';

// Style presets
const STYLE_PRESETS = [
  { id: VisualStyle.CHALKBOARD, label: 'Chalkboard', desc: 'Educational sketches on blackboard', color: 'from-emerald-800 to-emerald-950' },
  { id: VisualStyle.WHITEBOARD, label: 'Whiteboard', desc: 'Clean marker illustrations', color: 'from-slate-200 to-slate-400 text-slate-900' },
  { id: VisualStyle.ANIME, label: 'Anime', desc: 'Vibrant animated aesthetic', color: 'from-indigo-600 to-purple-800' },
  { id: VisualStyle.CYBERPUNK, label: 'Cyberpunk', desc: 'Neon futuristic sci-fi', color: 'from-fuchsia-700 to-purple-900' },
];

export default function App() {
  const [step, setStep] = useState<AppStep>('INPUT');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const [project, setProject] = useState<ProjectState>({
    topic: '',
    style: VisualStyle.CHALKBOARD,
    segments: []
  });

  // Step 1: Input Handler
  const handleGenerateScript = async () => {
    if (!project.topic.trim()) return;
    
    setIsLoading(true);
    setLoadingMessage('Researching topic and drafting storyboard...');
    
    try {
      const scriptSegments = await generateScript(project.topic);
      setProject(prev => ({
        ...prev,
        segments: scriptSegments.map(s => ({ ...s, isGenerating: false }))
      }));
      setStep('SCRIPT');
    } catch (err) {
      alert("Failed to generate script. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Script Edit Handler
  const handleScriptUpdate = (index: number, field: 'narration' | 'visualDescription', value: string) => {
    const newSegments = [...project.segments];
    newSegments[index] = { ...newSegments[index], [field]: value };
    setProject(prev => ({ ...prev, segments: newSegments }));
  };

  // Step 3: Style Selection -> Generation -> Rendering
  const handleStartGeneration = async () => {
    setStep('GENERATION');
    
    const newSegments = [...project.segments];
    
    try {
        // 1. Generate Assets (Voice & Images)
        for (let i = 0; i < newSegments.length; i++) {
            newSegments[i].isGenerating = true;
            setProject(prev => ({ ...prev, segments: [...newSegments] })); 
            
            // Voice
            if (!newSegments[i].audioUrl) {
                setLoadingMessage(`Recording voiceover for scene ${i + 1}...`);
                const { audioUrl, duration } = await generateVoiceForSegment(newSegments[i].narration);
                newSegments[i].audioUrl = audioUrl;
                newSegments[i].audioDuration = duration;
            }

            // Image
            if (!newSegments[i].imageUrl) {
                 setLoadingMessage(`Generating visuals for scene ${i + 1}...`);
                 const stylePrompt = project.style === VisualStyle.CUSTOM ? (project.customStylePrompt || '') : project.style;
                 const imageUrl = await generateImageForSegment(newSegments[i].visualDescription, stylePrompt);
                 newSegments[i].imageUrl = imageUrl;
            }

            newSegments[i].isGenerating = false;
            setProject(prev => ({ ...prev, segments: [...newSegments] }));
        }

        // 2. Render Final Video
        setLoadingMessage('Rendering final composition...');
        const videoUrl = await renderVideo(newSegments, (msg) => setLoadingMessage(msg));
        
        setProject(prev => ({ ...prev, finalVideoUrl: videoUrl }));
        setStep('RESULT');

    } catch (e) {
        console.error("Generation failed", e);
        alert("Something went wrong during generation. Please try again.");
        setStep('STYLE'); // Go back
    }
  };

  const handleDownload = () => {
    if (project.finalVideoUrl) {
      const a = document.createElement('a');
      a.href = project.finalVideoUrl;
      a.download = `reelsmith-${project.topic.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'INPUT':
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn">
             <div className="w-full max-w-3xl text-center space-y-10">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
                    <Sparkles size={14} /> AI-Powered Video Creation
                  </div>
                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-tight">
                    Turn Ideas into <br />
                    <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Viral Shorts</span>
                  </h1>
                  <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                    ReelSmith AI automates the entire production process: scripting, voiceovers, visuals, and editing.
                  </p>
                </div>

                <div className="relative group max-w-2xl mx-auto">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-60 transition duration-500"></div>
                  <div className="relative bg-slate-900 p-2 rounded-2xl flex items-center shadow-2xl border border-slate-700/50">
                    <div className="pl-4 pr-2 text-slate-400">
                      <Wand2 size={24} />
                    </div>
                    <input
                      type="text"
                      value={project.topic}
                      onChange={(e) => setProject(p => ({ ...p, topic: e.target.value }))}
                      placeholder="What should we create today? (e.g., 'The history of coffee')"
                      className="w-full bg-transparent text-white placeholder-slate-500 outline-none text-lg py-4 px-2"
                      onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
                    />
                    <Button 
                      onClick={handleGenerateScript} 
                      disabled={!project.topic.trim()}
                      isLoading={isLoading}
                      variant="glow"
                      className="ml-2 py-3 px-8 text-lg"
                    >
                      Create
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-16">
                   {[
                     { icon: TypeIcon, title: "Smart Scripting", desc: "Auto-research & storyboard generation" },
                     { icon: Palette, title: "Consistent Style", desc: "Uniform artistic direction across frames" },
                     { icon: Video, title: "Production Ready", desc: "Mixed audio & visuals in 9:16 format" }
                   ].map((feat, i) => (
                     <div key={i} className="glass-card p-6 rounded-2xl hover:bg-slate-800/60 transition-colors border border-slate-700/50">
                        <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-4 text-blue-400 border border-slate-700">
                          <feat.icon size={24} />
                        </div>
                        <h3 className="font-bold text-slate-100 text-lg mb-2">{feat.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{feat.desc}</p>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        );

      case 'SCRIPT':
        return (
          <div className="w-full max-w-5xl mx-auto animate-fadeIn pb-32">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Storyboard Editor</h2>
                <p className="text-slate-400">Review and refine the generated script segments.</p>
              </div>
              <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-sm text-slate-300">
                 {project.segments.length} Scenes
              </div>
            </div>

            <div className="space-y-6">
              {project.segments.map((seg, idx) => (
                <div key={seg.id} className="glass-card rounded-2xl p-6 border border-slate-700/50 relative overflow-hidden group">
                   {/* Scene Number */}
                   <div className="absolute top-0 left-0 bg-slate-800/80 backdrop-blur px-4 py-2 rounded-br-2xl border-r border-b border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider z-10">
                      Scene {idx + 1}
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
                      {/* Left: Narration */}
                      <div className="lg:col-span-7 space-y-3">
                        <label className="flex items-center gap-2 text-xs uppercase font-bold text-blue-400 tracking-wider">
                          <TypeIcon size={14} /> Voiceover Script
                        </label>
                        <textarea
                          value={seg.narration}
                          onChange={(e) => handleScriptUpdate(idx, 'narration', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none min-h-[120px] resize-none text-base leading-relaxed transition-all"
                          placeholder="Enter narration text..."
                        />
                      </div>
                      
                      {/* Right: Visual */}
                      <div className="lg:col-span-5 space-y-3">
                        <label className="flex items-center gap-2 text-xs uppercase font-bold text-purple-400 tracking-wider">
                          <Palette size={14} /> Visual Prompt
                        </label>
                        <textarea
                          value={seg.visualDescription}
                          onChange={(e) => handleScriptUpdate(idx, 'visualDescription', e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 outline-none min-h-[120px] resize-none text-sm leading-relaxed transition-all"
                          placeholder="Describe the image..."
                        />
                      </div>
                   </div>
                </div>
              ))}
            </div>
            
            <div className="fixed bottom-0 left-0 w-full glass border-t border-slate-700/50 p-6 flex justify-center z-50">
               <div className="max-w-5xl w-full flex justify-between items-center">
                  <Button variant="ghost" onClick={() => setStep('INPUT')}>Back</Button>
                  <Button variant="glow" onClick={() => setStep('STYLE')}>
                    Next Step <ChevronRight size={18} />
                  </Button>
               </div>
            </div>
          </div>
        );

      case 'STYLE':
        return (
          <div className="w-full max-w-5xl mx-auto animate-fadeIn pb-32">
            <h2 className="text-3xl font-bold text-white mb-2">Art Direction</h2>
            <p className="text-slate-400 mb-8">Select a visual style for your video.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {STYLE_PRESETS.map((s) => (
                 <button
                   key={s.id}
                   onClick={() => setProject(p => ({ ...p, style: s.id as VisualStyle }))}
                   className={`relative h-48 rounded-2xl border-2 text-left transition-all duration-300 overflow-hidden group flex flex-col justify-end p-6
                     ${project.style === s.id 
                       ? 'border-blue-500 ring-4 ring-blue-500/10 scale-[1.02]' 
                       : 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/50'}
                   `}
                 >
                   {/* Background Gradient */}
                   <div className={`absolute inset-0 bg-gradient-to-br ${s.color} opacity-20 group-hover:opacity-30 transition-opacity`}></div>
                   <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
                   
                   <div className="relative z-10">
                     <div className="flex justify-between items-end">
                       <div>
                         <h3 className={`text-2xl font-bold mb-1 ${project.style === s.id ? 'text-white' : 'text-slate-200'}`}>{s.label}</h3>
                         <p className="text-slate-400 text-sm font-medium">{s.desc}</p>
                       </div>
                       {project.style === s.id && (
                         <div className="bg-blue-500 text-white p-2 rounded-full shadow-lg shadow-blue-500/40">
                           <CheckIcon size={20} />
                         </div>
                       )}
                     </div>
                   </div>
                 </button>
               ))}
               
               {/* Custom Style Card */}
                <button
                   onClick={() => setProject(p => ({ ...p, style: VisualStyle.CUSTOM }))}
                   className={`relative h-48 rounded-2xl border-2 text-left transition-all duration-300 overflow-hidden flex flex-col p-6
                     ${project.style === VisualStyle.CUSTOM 
                       ? 'border-blue-500 ring-4 ring-blue-500/10 bg-slate-800' 
                       : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'}
                   `}
                 >
                   <div className="flex items-center gap-3 mb-4">
                     <div className="p-2 bg-slate-700 rounded-lg text-white">
                        <Wand2 size={20} />
                     </div>
                     <h3 className="text-xl font-bold text-slate-200">Custom Style</h3>
                   </div>
                   
                   <input 
                     type="text" 
                     placeholder="e.g. Claymation, Oil Painting, Pixel Art..."
                     className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none transition-colors"
                     value={project.customStylePrompt || ''}
                     onChange={(e) => setProject(p => ({ ...p, customStylePrompt: e.target.value }))}
                     onClick={(e) => { e.stopPropagation(); setProject(p => ({...p, style: VisualStyle.CUSTOM})) }} 
                   />
                 </button>
            </div>

            <div className="fixed bottom-0 left-0 w-full glass border-t border-slate-700/50 p-6 flex justify-center z-50">
               <div className="max-w-5xl w-full flex justify-between items-center">
                  <Button variant="ghost" onClick={() => setStep('SCRIPT')}>Back</Button>
                  <Button variant="glow" onClick={handleStartGeneration}>Generate Video <Film size={18}/></Button>
               </div>
            </div>
          </div>
        );

      case 'GENERATION':
        return (
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center animate-fadeIn">
            <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <Sparkles className="text-blue-400 animate-pulse" size={40} />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
               Producing Your Short
            </h2>
            <p className="text-slate-400 mb-8 text-lg font-medium animate-pulse">{loadingMessage}</p>
            
            <div className="w-full bg-slate-800/50 rounded-full h-3 mb-4 overflow-hidden border border-slate-700/50 max-w-md">
               <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-1/3 animate-[translateX_-100%_infinite_linear] origin-left" style={{ animation: 'slide 2s infinite ease-in-out' }}></div>
            </div>
            
            <p className="text-slate-500 text-sm mt-4">This process creates images, synthesis voice, and renders video in real-time.</p>

            <style>{`
              @keyframes slide {
                0% { transform: translateX(-100%); width: 20%; }
                50% { width: 50%; }
                100% { transform: translateX(400%); width: 20%; }
              }
            `}</style>
          </div>
        );

      case 'RESULT':
        return (
          <div className="w-full max-w-6xl mx-auto animate-fadeIn flex flex-col items-center pb-10">
             <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-medium mb-4">
                  <CheckIcon size={16} /> Rendering Complete
                </div>
                <h2 className="text-4xl font-bold text-white mb-2">Your Reel is Ready</h2>
             </div>

             <div className="flex flex-col lg:flex-row gap-12 items-center justify-center w-full">
                {/* Video Player */}
                <div className="relative group perspective-1000">
                   <div className="absolute -inset-1 bg-gradient-to-b from-blue-500 to-purple-600 rounded-[2.5rem] blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                   <div className="relative rounded-[2rem] overflow-hidden border-8 border-slate-900 bg-black shadow-2xl mx-auto z-10">
                      <video 
                         src={project.finalVideoUrl} 
                         controls 
                         autoPlay 
                         loop
                         className="max-h-[70vh] w-auto aspect-[9/16] object-contain block"
                      />
                   </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-6 w-full lg:w-96">
                   <div className="glass-card p-8 rounded-2xl border border-slate-700/50">
                      <h3 className="font-bold text-xl mb-2 text-white">Project Details</h3>
                      <div className="space-y-4 mb-8">
                         <div>
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Topic</span>
                            <p className="text-slate-300 font-medium">{project.topic}</p>
                         </div>
                         <div>
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Style</span>
                            <p className="text-slate-300 font-medium">{project.style}</p>
                         </div>
                         <div>
                            <span className="text-slate-500 text-xs uppercase font-bold tracking-wider">Duration</span>
                            <p className="text-slate-300 font-medium">~60 Seconds</p>
                         </div>
                      </div>
                      
                      <Button onClick={handleDownload} variant="glow" className="w-full mb-4 py-4 text-lg">
                         <Download size={20} /> Download Video
                      </Button>
                      
                      <Button onClick={() => setStep('INPUT')} variant="outline" className="w-full">
                         <RotateCcw size={18} /> Create New Reel
                      </Button>
                   </div>
                </div>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="p-4 border-b border-white/5 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                 <Clapperboard size={20} className="text-white" />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">ReelSmith AI</span>
           </div>
           
           {/* Only show stepper if we have started */}
           {step !== 'INPUT' && (
             <div className="hidden md:block">
               <div className="scale-75 origin-right">
                 {/* Compact stepper for nav */}
                 <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                    <span className={step === 'SCRIPT' ? 'text-white' : ''}>Script</span>
                    <ChevronRight size={14} />
                    <span className={step === 'STYLE' ? 'text-white' : ''}>Style</span>
                    <ChevronRight size={14} />
                    <span className={step === 'RESULT' ? 'text-white' : ''}>Result</span>
                 </div>
               </div>
             </div>
           )}
           
           <div>
             <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600"></div>
           </div>
        </div>
      </nav>
      
      {/* Mobile Stepper Container */}
      {step !== 'INPUT' && step !== 'RESULT' && (
        <div className="md:hidden px-4 pt-6 pb-2">
           <StepIndicator currentStep={step} />
        </div>
      )}
      
      {/* Desktop Stepper */}
      {step !== 'INPUT' && step !== 'RESULT' && (
        <div className="hidden md:block pt-8 px-6">
           <StepIndicator currentStep={step} />
        </div>
      )}

      <main className="p-6 md:p-8 max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
}

// Icon helper
function CheckIcon({ size = 24, ...props }: { size?: number, [key: string]: any }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}