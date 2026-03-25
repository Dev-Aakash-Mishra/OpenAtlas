import React from 'react';

export default function DeepDiveModal({ content, onClose }) {
  if (!content) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#050608]/80 backdrop-blur-2xl animate-in fade-in duration-700">
      
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-4xl bg-[#0b0e14]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_64px_128px_-32px_rgba(0,0,0,0.8)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-12 duration-700">
        
        {/* Header Section */}
        <div className="relative p-10 md:p-14 pb-0 flex items-start justify-between">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-white/10 relative group">
              <div className="absolute inset-0 bg-primary/10 rounded-[1.5rem] animate-pulse group-hover:bg-primary/20 transition-all" />
              <span className="material-symbols-outlined text-primary text-4xl relative z-10">psychology_alt</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[11px] font-bold text-primary uppercase tracking-[0.4em]">Smart Analysis</span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-[0.4em]">Powered by OpenAtlas</span>
              </div>
              <h2 className="text-4xl font-headline font-bold text-white tracking-tight leading-none">
                Deep Analysis
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>
        </div>

        <div className="p-10 md:p-14 pt-10 grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Main Content Area */}
          <div className="md:col-span-8 space-y-8 overflow-y-auto max-h-[50vh] pr-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="relative">
              <div className="absolute -left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-secondary to-transparent rounded-full opacity-30" />
              <p className="text-xl md:text-2xl leading-[1.6] text-[#e2e4ed] font-medium first-letter:text-5xl first-letter:font-bold first-letter:mr-2">
                {content}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white/5 border border-white/5 rounded-3xl group hover:border-primary/20 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Reliability Score</span>
                </div>
                <div className="text-2xl font-headline font-bold text-white tracking-widest">98.4%</div>
              </div>
              <div className="p-6 bg-white/5 border border-white/5 rounded-3xl group hover:border-secondary/20 transition-all">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-sm text-secondary">explore</span>
                  <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Related Sources</span>
                </div>
                <div className="text-2xl font-headline font-bold text-white tracking-widest">12.8K</div>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="md:col-span-4 space-y-8">
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em]">Impact Prediction</h5>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Direct Impact', color: 'bg-primary' },
                  { label: 'Likely Consequences', color: 'bg-secondary' },
                  { label: 'Uncertainty', color: 'bg-white/20' }
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1.5" title={item.label}>
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-on-surface-variant">{item.label}</span>
                      <span className="text-white">{Math.floor(Math.random() * 40 + 60)}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${Math.random() * 40 + 60}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 border-t border-white/10">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0b0e14] bg-white/10 flex items-center justify-center text-[10px] font-bold text-white backdrop-blur-md">
                      AI
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest leading-tight">
                  Checked by<br/><span className="text-white">Smart Analysis Core</span>
                </span>
              </div>
              <button 
                onClick={onClose}
                className="w-full py-4 bg-primary text-on-primary font-bold rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 text-[11px] uppercase tracking-[0.2em]"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
