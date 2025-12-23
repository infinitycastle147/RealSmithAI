
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'glow';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = React.memo(({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "relative px-6 py-3.5 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2.5 active:scale-[0.98] overflow-hidden group select-none";
  
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 border border-blue-500/50",
    glow: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/25 border border-white/10",
    secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/50",
    outline: "bg-transparent border-2 border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white",
    ghost: "bg-transparent hover:bg-white/5 text-slate-500 hover:text-white"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${isLoading || disabled ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Dynamic Shine effect */}
      {(variant === 'primary' || variant === 'glow') && (
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10 pointer-events-none"></div>
      )}
      
      {isLoading && (
        <svg className="animate-spin h-5 w-5 text-current relative z-20 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      
      <span className={`relative z-20 flex items-center gap-2.5 ${isLoading ? 'opacity-80' : ''}`}>
        {children}
      </span>
      
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </button>
  );
});
