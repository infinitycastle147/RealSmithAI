import React from 'react';
import { AppStep } from '../types';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps: { id: AppStep; label: string }[] = [
  { id: 'INPUT', label: 'Concept' },
  { id: 'STYLE', label: 'Style' },
  { id: 'SCRIPT', label: 'Script' },
  { id: 'RESULT', label: 'Finish' }, 
];

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const getStepStatus = (id: AppStep) => {
    // New logical order: INPUT -> STYLE -> SCRIPT -> GENERATION -> RESULT
    const order = ['INPUT', 'STYLE', 'SCRIPT', 'GENERATION', 'RESULT'];
    
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(id);
    
    if (currentStep === 'GENERATION' && id === 'RESULT') return 'upcoming';
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="flex items-center justify-center w-full mb-10">
      {steps.map((step, idx) => {
        const status = getStepStatus(step.id);
        const isLast = idx === steps.length - 1;
        
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2 relative z-10">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border transition-all duration-500 shadow-xl
                ${status === 'completed' ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-900/50' : ''}
                ${status === 'current' ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/50 scale-110' : ''}
                ${status === 'upcoming' ? 'bg-slate-900 border-slate-700 text-slate-600' : ''}
              `}>
                {status === 'completed' ? <Check size={18} strokeWidth={3} /> : idx + 1}
              </div>
              <span className={`absolute top-12 whitespace-nowrap text-xs font-semibold tracking-wide transition-colors duration-300
                ${status === 'current' ? 'text-blue-400' : ''}
                ${status === 'completed' ? 'text-emerald-400' : ''}
                ${status === 'upcoming' ? 'text-slate-600' : ''}
              `}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className="flex-1 h-[2px] mx-2 min-w-[3rem] md:min-w-[6rem] relative">
                  <div className="absolute inset-0 bg-slate-800 rounded-full"></div>
                  <div className={`absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full transition-all duration-700 origin-left
                    ${status === 'completed' ? 'scale-x-100' : 'scale-x-0'}
                  `}></div>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};