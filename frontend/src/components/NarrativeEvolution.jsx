import React from 'react';

const NarrativeEvolution = ({ query, evolutionData, isLoading, onNodeClick, onClose }) => {
  if (!evolutionData && !isLoading) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 top-16 bg-surface/80 backdrop-blur-3xl z-50 flex flex-col items-center animate-in fade-in slide-in-from-bottom-10 duration-500">
      {/* Header */}
      <div className="w-full max-w-5xl px-8 py-8 flex justify-between items-end border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-3xl">timeline</span>
            <h2 className="text-3xl font-headline font-bold tracking-tight text-on-surface">
              Narrative Evolution
            </h2>
          </div>
          <p className="text-on-surface-variant/70 text-sm font-medium tracking-wide flex items-center gap-2">
            Tracking strategic transformation for: 
            <span className="text-secondary font-bold px-2 py-0.5 bg-secondary/10 rounded-md border border-secondary/20">
              {query || 'Current Context'}
            </span>
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-3 rounded-full bg-white/5 border border-white/10 text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all active:scale-95 group"
        >
          <span className="material-symbols-outlined text-2xl group-hover:rotate-90 transition-transform duration-300">close</span>
        </button>
      </div>

      {/* Timeline Content */}
      <div className="flex-1 w-full overflow-y-auto scrollbar-thin px-8 py-12 flex flex-col items-center">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-on-surface-variant/60 font-headline font-bold uppercase tracking-widest text-xs">
              Synthesizing Chronological Data...
            </p>
          </div>
        ) : evolutionData && evolutionData.length > 0 ? (
          <div className="relative w-full max-w-4xl">
            {/* Central Stem */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-secondary/30 to-transparent"></div>

            <div className="space-y-24 relative pb-24">
              {evolutionData.map((node, index) => {
                const isEven = index % 2 === 0;
                const date = node.timestamp ? new Date(node.timestamp).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Historical Root';

                return (
                  <div 
                    key={node.id} 
                    className={`flex items-center w-full ${isEven ? 'flex-row' : 'flex-row-reverse'}`}
                  >
                    {/* Content Card */}
                    <div className={`w-[45%] group`}>
                      <button
                        onClick={() => onNodeClick(node.id)}
                        className={`w-full p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl text-left hover:border-primary/40 hover:bg-primary/5 transition-all duration-500 group-hover:shadow-[0_0_30px_rgba(159,167,255,0.05)] relative overflow-hidden`}
                      >
                        {/* Domain Indicator */}
                        <div className={`absolute top-0 right-0 px-3 py-1 bg-white/5 border-b border-l border-white/10 rounded-bl-xl text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60`}>
                          {node.domain}
                        </div>

                        <div className="text-[10px] font-headline font-bold text-primary tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                           {date}
                        </div>
                        <h3 className="text-lg font-headline font-bold text-on-surface leading-tight mb-3">
                          {node.content.split(' ').slice(0, 12).join(' ')}{node.content.split(' ').length > 12 ? '...' : ''}
                        </h3>
                        <p className="text-xs text-on-surface-variant/80 leading-relaxed font-medium line-clamp-3">
                          {node.content}
                        </p>
                      </button>
                    </div>

                    {/* Central Node Dot */}
                    <div className="w-[10%] flex justify-center z-10">
                      <div className={`w-4 h-4 rounded-full border-2 bg-surface ${node.sentiment > 0.1 ? 'border-secondary shadow-[0_0_12px_rgba(98,250,227,0.4)]' : node.sentiment < -0.1 ? 'border-error shadow-[0_0_12px_rgba(255,110,132,0.4)]' : 'border-primary shadow-[0_0_12px_rgba(159,167,255,0.4)]'} relative`}>
                        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-inherit"></div>
                      </div>
                    </div>

                    {/* Empty Space for alignment */}
                    <div className="w-[45%]"></div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <span className="material-symbols-outlined text-6xl text-white/5 mb-6">explore_off</span>
            <p className="text-on-surface-variant/60 font-headline font-bold uppercase tracking-widest text-sm mb-2">
              No Narrative Arc Detected
            </p>
            <p className="text-on-surface-variant/40 text-xs italic">
              Try exploring broader strategic themes or searching for specific policy keywords.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NarrativeEvolution;
