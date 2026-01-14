import React from 'react';
import { X, LogIn } from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';
import { Button } from './Button';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
    const { openSignIn } = useClerk();

    if (!isOpen) return null;

    const handleLogin = () => {
        onClose();
        openSignIn({
            redirectUrl: window.location.href,
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
                <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl bg-slate-900/90">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                    >
                        <X size={20} />
                    </button>

                    {/* Content */}
                    <div className="space-y-6">
                        {/* Icon */}
                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
                            <LogIn className="text-blue-400" size={32} />
                        </div>

                        {/* Title */}
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-white">Sign In Required</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Please sign in to start creating amazing AI-powered videos. It's quick and free!
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 pt-4">
                            <Button
                                onClick={handleLogin}
                                variant="glow"
                                className="w-full py-4 text-base font-bold rounded-xl"
                            >
                                <LogIn size={20} />
                                Sign In to Continue
                            </Button>
                            <Button
                                onClick={onClose}
                                variant="ghost"
                                className="w-full py-3 text-sm text-slate-400 hover:text-white"
                            >
                                Maybe Later
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
