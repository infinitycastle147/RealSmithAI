
import React from 'react';
import { AppStep } from '../types';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps: { id: AppStep; label: string }[] = [
  { id: 'INPUT', label: 'Idea' },
  { id: 'STYLE', label: 'Style' },
  { id: 'SCRIPT', label: 'Scenes' },
  { id: 'RESULT', label: 'Ready' }, 
];

export const StepIndicator: React.FC<StepIndicatorProps> = React.memo(({ currentStep }) => {
  const getStepStatus = (id: AppStep) => {
    const order = ['INPUT', 'STYLE', 'SCRIPT', 'GENERATION', 'RESULT'];
    
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(id);
    
    // Result logic should also handle the internal generation step
    if (currentStep === 'GENERATION' && id === 'RESULT') return 'upcoming';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, idx) => {
        const status = getStepStatus(step.id);
        const isLast = idx === steps.length - 1;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-3 relative">
              <div className={`
                w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black border-2 transition-all duration-500 shadow-lg relative z-10
                ${status === 'completed' ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' : ''}
                ${status === 'current' ? 'bg-blue-600 border-blue-400 text-white shadow-blue-500/30 scale-110' : ''}
                ${status === 'upcoming' ? 'bg-slate-900 border-slate-800 text-slate-600' : ''}
              `}>
                {status === 'completed' ? <Check size={18} strokeWidth={3} /> : idx + 1}
              </div>
              <span className={`absolute -bottom-7 whitespace-nowrap text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300
                ${status === 'current' ? 'text-blue-400 translate-y-0.5' : 'text-slate-600'}
                ${status === 'completed' ? 'text-emerald-500' : ''}
              `}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-[2px] mx-3 min-w-[1.5rem] sm:min-w-[3rem] relative -translate-y-4">
                  <div className="absolute inset-0 bg-slate-800 rounded-full"></div>
                  <div className={`absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full transition-all duration-1000 origin-left ease-out
                    ${status === 'completed' ? 'scale-x-100' : 'scale-x-0'}
                  `}></div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});
