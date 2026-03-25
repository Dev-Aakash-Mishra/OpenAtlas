import React, { useEffect, useState } from 'react';

const LoadingModal = ({ isOpen, onClose, apiBase = '' }) => {
  const [status, setStatus] = useState({ state: 'idle', message: 'Initializing...', error: null });
  const [logIndex, setLogIndex] = useState(0);

  const logs = [
    "Analyzing latest Indian and global news...",
    "Correlating regional event patterns...",
    "Updating the Bharat intelligence map...",
    "Processing multi-language news feeds...",
    "Extracting local relevance and context...",
    "Mapping narrative threads...",
    "Analyzing across states and districts...",
    "Finalizing knowledge graph..."
  ];

  useEffect(() => {
    if (status.state === 'processing' || status.state === 'fetching') {
      const logInterval = setInterval(() => {
        setLogIndex(prev => (prev + 1) % logs.length);
      }, 2500);
      return () => clearInterval(logInterval);
    }
  }, [status.state]);

  useEffect(() => {
    if (!isOpen) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`${apiBase}/api/status`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
          
          if (data.state === 'idle') {
            // Auto close after 3 seconds of showing success
            setTimeout(onClose, 3000);
          }
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, 1500);
    pollStatus();

    return () => clearInterval(interval);
  }, [isOpen, apiBase]);

  if (!isOpen) return null;

  const isRateLimited = status.state === 'rate-limited';
  const isError = status.state === 'error';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0b0e14]/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`relative max-w-lg w-full bg-surface-container-high border ${isRateLimited ? 'border-yellow-500/30' : 'border-primary/20'} rounded-[2.5rem] shadow-2xl p-8 overflow-hidden`}>
        
        {/* Background Glow */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 blur-[80px] rounded-full ${isRateLimited ? 'bg-yellow-500/20' : 'bg-primary/20'}`}></div>
        
        <div className="relative flex flex-col items-center text-center gap-6">
          {/* Animated Loader / Icon */}
          <div className="relative">
            {isRateLimited ? (
              <div className="w-20 h-20 flex items-center justify-center bg-yellow-500/10 rounded-full text-yellow-500 animate-pulse">
                <span className="material-symbols-outlined text-4xl">hourglass_empty</span>
              </div>
            ) : isError ? (
              <div className="w-20 h-20 flex items-center justify-center bg-red-500/10 rounded-full text-red-500">
                <span className="material-symbols-outlined text-4xl">error</span>
              </div>
            ) : (
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-3xl animate-pulse">neurology</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className={`text-2xl font-headline font-bold uppercase tracking-widest ${isRateLimited ? 'text-yellow-500' : isError ? 'text-red-500' : status.state === 'idle' ? 'text-emerald-500' : 'text-primary'}`}>
              {status.state === 'idle' ? 'SUCCESS' : status.state.toUpperCase()}
            </h3>
            <p className="text-[#ecedf6]/80 text-sm font-medium leading-relaxed max-w-xs mx-auto min-h-[40px]">
              {status.state === 'processing' ? logs[logIndex] : status.message}
            </p>
          </div>

          {/* Progress Bar / Indicator */}
          {!isError && (
            <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden border border-outline-variant/10">
              <div 
                className={`h-full transition-all duration-1000 ${isRateLimited ? 'bg-yellow-500 w-full animate-pulse' : 'bg-primary w-2/3'}`}
                style={{ width: status.state === 'idle' ? '100%' : undefined }}
              ></div>
            </div>
          )}

          {isRateLimited && (
              <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl text-[11px] text-yellow-500/80 italic">
                Reason: AI generation limits reached. The system will automatically resume once the window clears.
              </div>
          )}

          {(isError || status.state === 'idle') && (
            <button 
              onClick={onClose}
              className="mt-4 px-8 py-3 bg-surface-container-highest hover:bg-surface-container-low text-on-surface text-sm font-bold rounded-xl transition-all active:scale-95 border border-outline-variant/10"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;
