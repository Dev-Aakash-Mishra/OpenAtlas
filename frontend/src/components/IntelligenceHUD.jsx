import React, { useEffect, useState } from 'react';

const IntelligenceHUD = ({ isOpen, onClose, apiBase = '' }) => {
  const [status, setStatus] = useState({ state: 'idle', message: 'Initializing...', error: null });
  const [logIndex, setLogIndex] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  // Reset minimized state when opened fresh
  useEffect(() => {
    if (isOpen) setIsMinimized(false);
  }, [isOpen]);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return; // Don't drag if clicking buttons
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

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
            // Auto close after 5 seconds of success
            setTimeout(onClose, 5000);
          }
        }
      } catch (err) {
        console.error("Status poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, 2000);
    pollStatus();

    return () => clearInterval(interval);
  }, [isOpen, apiBase, onClose]);

  if (!isOpen) return null;

  const isRateLimited = status.state === 'rate-limited';
  const isError = status.state === 'error';
  const isIdle = status.state === 'idle';

  return (
    <div 
      className="fixed bottom-8 right-8 z-[200] max-w-sm w-full animate-in slide-in-from-right-8 duration-500 select-none transition-all"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.5s ease, opacity 0.5s ease',
        maxWidth: isMinimized ? '64px' : '384px'
      }}
    >
      <div className={`relative bg-surface-container-high/40 backdrop-blur-3xl border ${isRateLimited ? 'border-yellow-500/30' : isError ? 'border-red-500/30' : 'border-primary/20'} ${isMinimized ? 'rounded-2xl p-2' : 'rounded-[2rem] p-7'} shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden group transition-all duration-500`}>
        
        {/* Drag Handle Area */}
        <div 
          onMouseDown={handleMouseDown}
          className={`absolute top-0 left-0 right-0 ${isMinimized ? 'bottom-0' : 'h-14'} cursor-grab active:cursor-grabbing z-10`}
          title="Drag to move"
        ></div>
        
        {/* Background Mesh Gradient */}
        {!isMinimized && (
          <div className={`absolute -top-24 -right-24 w-48 h-48 blur-[100px] rounded-full transition-colors duration-1000 ${isRateLimited ? 'bg-yellow-500/10' : isError ? 'bg-red-500/10' : isIdle ? 'bg-emerald-500/10' : 'bg-primary/20'}`}></div>
        )}

        {isMinimized ? (
          /* Minimized "Orb" View */
          <div className="relative z-20 flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${isRateLimited ? 'bg-yellow-500/10' : isError ? 'bg-red-500/10' : isIdle ? 'bg-emerald-500/10' : 'bg-primary/20'}`}>
              <div className="relative w-6 h-6">
                 {!isIdle && !isError && <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>}
                 <span className={`material-symbols-outlined text-sm ${isIdle ? 'text-emerald-500' : isError ? 'text-red-500' : 'text-primary'}`}>
                   {isIdle ? 'verified' : isError ? 'error' : 'neurology'}
                 </span>
              </div>
            </div>
            <button 
              onClick={() => setIsMinimized(false)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors text-on-surface/40 hover:text-on-surface"
              title="Expand"
            >
              <span className="material-symbols-outlined text-lg">unfold_more</span>
            </button>
          </div>
        ) : (
          /* Full Mission Control View */
          <div className="relative z-20 flex items-center gap-5">
            {/* Neural Core Visualizer */}
            <div className="flex-shrink-0 relative">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isRateLimited ? 'bg-yellow-500/10' : isError ? 'bg-red-500/10' : isIdle ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
                {isIdle ? (
                  <span className="material-symbols-outlined text-2xl text-emerald-500 animate-in zoom-in duration-500">verified</span>
                ) : isError ? (
                  <span className="material-symbols-outlined text-2xl text-red-500">error</span>
                ) : (
                  <div className="relative w-8 h-8">
                    <div className="absolute inset-0 border-2 border-primary/20 rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-2 bg-primary/20 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5" onClick={() => setIsMinimized(true)} style={{ cursor: 'pointer' }}>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isIdle ? 'bg-emerald-500' : isError ? 'bg-red-500' : isRateLimited ? 'bg-yellow-500' : 'bg-primary'}`}></div>
                    <h4 className={`text-[10px] font-bold uppercase tracking-[0.25em] ${isRateLimited ? 'text-yellow-500' : isError ? 'text-red-500' : isIdle ? 'text-emerald-500' : 'text-primary'}`}>
                      {isIdle ? 'Signal Synchronized' : isRateLimited ? 'Latency Detected' : 'Intelligence Stream'}
                    </h4>
                  </div>
                  <p className="text-xs text-[#ecedf6] font-semibold tracking-tight truncate pr-4">
                    {status.state === 'processing' ? logs[logIndex] : status.message}
                  </p>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setIsMinimized(true)} 
                    className="p-1 hover:bg-white/5 rounded-lg transition-colors group/mini"
                    title="Minimize to Background"
                  >
                    <span className="material-symbols-outlined text-lg text-on-surface/30 group-hover/mini:text-on-surface">unfold_less</span>
                  </button>
                  {(isIdle || isError) ? (
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg transition-colors group/close">
                      <span className="material-symbols-outlined text-lg text-on-surface/30 group-hover/close:text-on-surface">close</span>
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Segmented Progress bar */}
              {!isError && (
                <div className="mt-4 flex gap-1.5">
                  {[0, 1, 2, 3].map((i) => {
                    let active = false;
                    if (isIdle) active = true;
                    else if (status.state === 'processing') {
                      const stepSize = logs.length / 4;
                      active = logIndex >= (i * stepSize);
                    }
                    
                    return (
                      <div key={i} className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full transition-all duration-700 ${active ? (isIdle ? 'bg-emerald-500' : 'bg-primary') : 'bg-transparent'} ${!isIdle && active && (logIndex % 4 === i) ? 'animate-pulse opacity-70' : ''}`}></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {!isMinimized && isRateLimited && (
           <div className="mt-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl flex items-center gap-3">
             <span className="material-symbols-outlined text-lg text-yellow-500/60">warning</span>
             <p className="text-[10px] text-yellow-500/80 leading-tight font-medium">
               Resource Exhausted. Standby for automated recovery...
             </p>
           </div>
        )}
      </div>
    </div>
  );
};

export default IntelligenceHUD;
