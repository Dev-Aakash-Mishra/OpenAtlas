import { useState } from 'react';

export default function DetailPanel({ node, onClose, domainColor, onFollowThread, onPredictBranch, onMaterialize }) {
  const {
    content,
    domain,
    key_elements,
    speculation,
    confidence,
    timestamp,
    id,
    next,
    prev,
    source_url,
    isGhost,
  } = node;

  const [deepDive, setDeepDive] = useState(null);
  const [loadingDeepDive, setLoadingDeepDive] = useState(false);

  const handleDeepDive = () => {
    setLoadingDeepDive(true);
    fetch(`/api/deep_dive/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setDeepDive(data.analysis);
        } else {
          alert("Deep dive failed: " + data.message);
        }
      })
      .catch(err => console.error("Deep dive error", err))
      .finally(() => setLoadingDeepDive(false));
  };

  return (
    <div className="absolute top-6 right-6 z-50 w-80 bg-surface-container-high/90 backdrop-blur-2xl border border-outline-variant/15 rounded-2xl shadow-2xl p-6 animate-in slide-in-from-right-8 duration-300 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin scrollbar-thumb-outline-variant/30 scrollbar-track-transparent">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-headline font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">
          {isGhost ? 'Speculative Entity' : 'Entity Selected'}
        </span>
        <button onClick={onClose} className="hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant text-sm">close</span>
        </button>
      </div>

      <h2 className="text-xl font-headline font-bold mb-2 leading-tight">{content?.split('.')[0]}</h2>
      <p className="text-xs text-on-surface-variant leading-relaxed mb-6">
        {content}
      </p>

      {deepDive && (
        <div className="mb-6 relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative p-5 bg-surface-container-highest/90 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-xl overflow-hidden">
             {/* Quantum Circuit Mesh Background */}
             <div className="absolute inset-0 opacity-5 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="mesh" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#mesh)" />
                </svg>
             </div>

             <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-sm animate-spin-slow">psychology</span>
                <h5 className="text-[10px] font-headline text-primary uppercase tracking-[0.2em] font-bold">Quantum Intelligence Deep-Dive</h5>
             </div>
             <p className="text-xs leading-relaxed text-[#ecedf6] font-medium italic relative z-10">"{deepDive}"</p>
             
             <div className="mt-4 flex justify-end">
                <div className="h-0.5 w-12 bg-gradient-to-r from-transparent to-primary/40 rounded-full"></div>
             </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h5 className="text-[10px] font-headline text-on-surface-variant uppercase tracking-widest mb-3">Key Elements</h5>
          <div className="flex flex-wrap gap-2">
            {(key_elements || []).map((k) => (
              <span key={k} className="text-[10px] px-2 py-1 bg-surface-container-highest rounded border border-outline-variant/10 text-on-surface/80">
                {k}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h5 className="text-[10px] font-headline text-on-surface-variant uppercase tracking-widest mb-3">System Context</h5>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-surface-container-highest rounded-xl border border-outline-variant/5">
              <span className="text-[8px] uppercase tracking-tighter text-on-surface-variant block mb-1">Outgoing</span>
              <span className="text-lg font-headline font-bold text-primary">{next?.length || 0}</span>
            </div>
            <div className="p-3 bg-surface-container-highest rounded-xl border border-outline-variant/5">
              <span className="text-[8px] uppercase tracking-tighter text-on-surface-variant block mb-1">Incoming</span>
              <span className="text-lg font-headline font-bold text-secondary">{prev?.length || 0}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {isGhost ? (
            <button 
              className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/20"
              onClick={() => onMaterialize(node)}
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Materialize to Graph
            </button>
          ) : (
            <>
              <button 
                className="w-full bg-primary text-on-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/20"
                onClick={() => onFollowThread(id)}
              >
                <span className="material-symbols-outlined text-sm">account_tree</span>
                Follow Narrative Thread
              </button>
              <button 
                className="w-full bg-surface-container-highest border border-outline-variant/20 text-on-surface font-bold py-3 rounded-xl hover:bg-surface-variant transition-all flex items-center justify-center gap-2 text-xs"
                onClick={() => onPredictBranch(id)}
              >
                <span className="material-symbols-outlined text-sm">online_prediction</span>
                Predict Consequences
              </button>
            </>
          )}
          
          <button 
            className="w-full py-2 text-[10px] text-primary hover:text-primary-dim transition-colors flex items-center justify-center gap-1 font-bold tracking-tight"
            onClick={handleDeepDive}
            disabled={loadingDeepDive}
          >
            <span className="material-symbols-outlined text-xs">{loadingDeepDive ? 'hourglass_empty' : 'psychology'}</span>
            {loadingDeepDive ? 'Analyzing Patterns...' : 'Quantum Analysis Deep Dive'}
          </button>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-outline-variant/10 flex items-center justify-between text-[9px] text-on-surface-variant font-medium">
        <span>{new Date(timestamp).toLocaleDateString()}</span>
        {source_url && (
          <a href={source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
            Original Source <span className="material-symbols-outlined text-[10px]">open_in_new</span>
          </a>
        )}
      </div>
    </div>
  );
}
