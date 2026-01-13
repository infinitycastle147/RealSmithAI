import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Zap, Clock, AlertTriangle } from 'lucide-react';

interface QuotaStatus {
  userId: string;
  dailyTokens: number;
  tokensUsed: number;
  tokensRemaining: number;
  requestsUsed: number;
  requestsRemaining: number;
  dailyRequestLimit: number;
  lastResetDate: string;
  resetTime: string;
}

interface QuotaDisplayProps {
  className?: string;
}

export const QuotaDisplay: React.FC<QuotaDisplayProps> = ({ className = '' }) => {
  const { getToken } = useAuth();
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeUntilReset, setTimeUntilReset] = useState<string>('');

  const fetchQuota = async () => {
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/quota/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setQuota(data.data);
      } else {
        // If quota endpoint fails, don't show error - just hide component
        console.warn('Failed to fetch quota status:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error);
      // Don't show error to user - quota display will just not appear
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
    // Refresh quota every 30 seconds
    const interval = setInterval(fetchQuota, 30000);
    
    // Listen for quota update events from API calls
    const handleQuotaUpdate = () => {
      fetchQuota();
    };
    window.addEventListener('quota-updated', handleQuotaUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('quota-updated', handleQuotaUpdate);
    };
  }, []);

  useEffect(() => {
    if (!quota) return;

    const updateCountdown = () => {
      const resetTime = new Date(quota.resetTime);
      const now = new Date();
      const diff = resetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilReset('Resetting...');
        fetchQuota(); // Refresh quota
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeUntilReset(`${hours}h ${minutes}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [quota]);

  if (loading || !quota) {
    return (
      <div className={`flex items-center gap-2 text-sm text-slate-400 ${className}`}>
        <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading quota...</span>
      </div>
    );
  }

  const tokenPercentage = (quota.tokensUsed / quota.dailyTokens) * 100;
  const requestPercentage = (quota.requestsUsed / quota.dailyRequestLimit) * 100;
  const isLowQuota = tokenPercentage > 80 || requestPercentage > 80;
  const isExhausted = quota.tokensRemaining === 0 || quota.requestsRemaining === 0;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {/* Tokens Progress */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <Zap size={16} className={`${isLowQuota ? 'text-yellow-400' : 'text-blue-400'}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Tokens</span>
            <span className={`font-bold ${isLowQuota ? 'text-yellow-400' : 'text-slate-300'}`}>
              {quota.tokensRemaining.toLocaleString()} / {quota.dailyTokens.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isExhausted
                  ? 'bg-red-500'
                  : isLowQuota
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, tokenPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Requests Progress */}
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Requests</span>
            <span className={`font-bold ${isLowQuota ? 'text-yellow-400' : 'text-slate-300'}`}>
              {quota.requestsRemaining} / {quota.dailyRequestLimit}
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all ${
                isExhausted
                  ? 'bg-red-500'
                  : isLowQuota
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, requestPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Reset Timer */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Clock size={12} />
        <span>Resets in {timeUntilReset}</span>
      </div>

      {/* Warning Icon */}
      {isExhausted && (
        <div className="flex items-center gap-1 text-xs text-red-400" title="Quota exhausted">
          <AlertTriangle size={14} />
          <span>Quota Exceeded</span>
        </div>
      )}
    </div>
  );
};
