import { useState } from 'react';

export default function DetailPanel({ 
  node, 
  onClose, 
  domainColor, 
  onFollowThread, 
  onPredictBranch, 
  onMaterialize,
  onEvolution,
  isProcessingThread,
  isPredicting,
  showToast
}) {
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
    state,
    district,
    language,
    source_language,
    local_relevance,
    trust_score,
    bias_warning,
    publisher,
    lat,
    lng,
  } = node;

  const [deepDive, setDeepDive] = useState(null);
  const [loadingDeepDive, setLoadingDeepDive] = useState(false);

  const handleDeepDiveInternal = () => {
    setLoadingDeepDive(true);
    fetch(`/api/deep_dive/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          node.onDeepDive(data.analysis);
        } else {
          showToast("Deep dive failed: " + data.message, 'error');
        }
      })
      .catch(err => console.error("Deep dive error", err))
      .finally(() => setLoadingDeepDive(false));
  };

  return (
    <div className="absolute top-6 right-4 md:right-6 z-50 w-[calc(100%-2rem)] sm:w-[380px] bg-[#0b0e14]/90 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] flex flex-col animate-in slide-in-from-right-12 duration-500 max-h-[calc(100vh-120px)] overflow-hidden">
      
      {/* Decorative Top Accent */}
      <div 
        className="h-1.5 w-full" 
        style={{ background: `linear-gradient(90deg, ${domainColor} 0%, ${domainColor}55 100%)` }}
      />

      <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div 
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: domainColor }}
            />
            <span className="text-[10px] font-headline font-bold text-on-surface-variant uppercase tracking-[0.2em]">
              {isGhost ? 'Expert Prediction' : 'Intelligence Report'}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-white transition-all active:scale-90"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Publisher & Trust Section */}
        <div className="flex items-start gap-4 mb-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-sm text-primary">verified</span>
              <span className="text-xs font-bold text-on-surface uppercase tracking-wide">{publisher || 'Global Network'}</span>
            </div>
            <div className="text-[10px] text-on-surface-variant/60 font-medium">
              Report ID: <span className="font-mono text-[9px]">{id.substring(0, 8)}</span>
            </div>
          </div>
          
          {trust_score !== undefined && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-headline font-bold text-primary">{trust_score}%</span>
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${bias_warning ? 'bg-orange-500' : 'bg-primary'}`}
                    style={{ width: `${trust_score}%` }}
                  />
                </div>
              </div>
              <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface-variant/50">
                {bias_warning ? 'Bias Detected' : 'Reliability Index'}
              </span>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="space-y-4 mb-8">
          <h2 className="text-2xl font-headline font-bold leading-[1.15] text-white tracking-tight">
            {content?.split('.')[0]}
          </h2>
          <div className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full opacity-20" style={{ backgroundColor: domainColor }} />
            <p className="text-[13px] text-on-surface-variant/90 leading-relaxed font-medium">
              {content}
            </p>
          </div>
        </div>

        {/* Geo-Context Section */}
        {(state || local_relevance) && (
          <div className="mb-8 space-y-4">
            {state && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary border border-secondary/20">
                  <span className="material-symbols-outlined text-lg">location_on</span>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-none mb-1">Impact Zone</div>
                  <div className="text-xs font-bold text-on-surface">{district ? `${district}, ${state}` : state}</div>
                </div>
              </div>
            )}
            
            {local_relevance && (
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-sm text-secondary">info</span>
                  <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Local Context (India)</span>
                </div>
                <p className="text-[11px] font-medium text-on-surface-variant leading-relaxed italic">
                  "{local_relevance}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mini-Map for geo-tagged events */}
        {lat && lng && (
          <div className="mb-8 group">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-on-surface-variant/50 uppercase tracking-widest">Geospatial Marker</span>
              <span className="text-[10px] font-mono text-on-surface-variant/40">{lat.toFixed(3)}, {lng.toFixed(3)}</span>
            </div>
            <div className="relative h-32 rounded-2xl overflow-hidden border border-white/5 group-hover:border-primary/30 transition-colors">
              <iframe
                title="Event Location"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.5},${lat-0.5},${lng+0.5},${lat+0.5}&layer=mapnik&marker=${lat},${lng}`}
                className="w-full h-full border-0 brightness-[0.7] contrast-[1.2] grayscale-[0.3]"
                loading="lazy"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-2xl" />
            </div>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-primary/20 transition-all">
            <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] block mb-2">Propagations</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-headline font-bold text-primary">{next?.length || 0}</span>
              <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase">Nodes</span>
            </div>
          </div>
          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-secondary/20 transition-all">
            <span className="text-[9px] font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] block mb-2">Ancestry</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-headline font-bold text-secondary">{prev?.length || 0}</span>
              <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase">Roots</span>
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {(key_elements || []).map((k) => (
              <span key={k} className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[9px] font-bold text-on-surface-variant transition-colors cursor-default">
                #{k.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-[0.2em] px-1">Strategic Operations</span>
            
            {isGhost ? (
              <button 
                className="w-full group relative overflow-hidden bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-primary/5"
                onClick={() => onMaterialize(node)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <span className="material-symbols-outlined text-base">auto_awesome</span>
                <span>Materialize Prediction</span>
              </button>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    className={`group relative overflow-hidden bg-white/5 hover:bg-white/10 text-on-surface border border-white/5 hover:border-primary/40 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center ${isProcessingThread ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => onFollowThread(id)}
                    disabled={isProcessingThread}
                  >
                    <span className={`material-symbols-outlined text-xl text-primary/80 group-hover:text-primary transition-colors ${isProcessingThread ? 'animate-spin' : ''}`}>
                      {isProcessingThread ? 'sync' : 'account_tree'}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest leading-none">Trace Thread</span>
                  </button>
                  
                  <button 
                    className="group relative overflow-hidden bg-white/5 hover:bg-white/10 text-on-surface border border-white/5 hover:border-secondary/40 p-4 rounded-2xl transition-all duration-300 flex flex-col items-center justify-center gap-2 text-center"
                    onClick={() => onEvolution(id, (key_elements && key_elements[0]) || content?.split(' ')[0])}
                  >
                    <span className="material-symbols-outlined text-xl text-secondary/80 group-hover:text-secondary transition-colors">timeline</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest leading-none">Evolution Arc</span>
                  </button>
                </div>

                <button 
                  className={`w-full group relative overflow-hidden bg-white/5 hover:bg-white/10 text-on-surface border border-white/5 hover:border-white/20 py-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-widest ${isPredicting ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => onPredictBranch(id)}
                  disabled={isPredicting}
                >
                  <span className={`material-symbols-outlined text-base transition-colors ${isPredicting ? 'animate-spin text-primary' : 'text-on-surface-variant/70 group-hover:text-white'}`}>
                    {isPredicting ? 'sync' : 'online_prediction'}
                  </span>
                  <span>{isPredicting ? 'Projecting...' : 'Project Consequences'}</span>
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-[0.2em] px-1">Advanced Analysis</span>
            <button 
              className="w-full relative overflow-hidden py-4 text-[11px] text-primary bg-primary/5 hover:bg-primary/10 rounded-2xl border border-primary/20 hover:border-primary/40 transition-all font-bold tracking-widest uppercase flex items-center justify-center gap-3 shadow-lg shadow-primary/5 group"
              onClick={handleDeepDiveInternal}
              disabled={loadingDeepDive}
            >
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="material-symbols-outlined text-base">{loadingDeepDive ? 'hourglass_empty' : 'psychology_alt'}</span>
              {loadingDeepDive ? 'Synthesizing...' : 'Run Neuro-Analysis'}
            </button>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Discovery Date</span>
            <span className="text-[10px] text-on-surface-variant font-bold">{new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {source_url && (
              <a 
                href={source_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
                title="View Intelligence Source"
              >
                <span className="material-symbols-outlined text-lg">open_in_new</span>
              </a>
            )}
            <button 
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-on-surface-variant hover:text-green-500 hover:bg-green-500/10 transition-all"
              onClick={() => {
                const headline = content?.split('.')[0] || 'Intelligence Report';
                const url = source_url || window.location.href;
                const text = `🔹 ${headline}\n\nExplore this insight on OpenAtlas: ${url}`;
                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
              }}
              title="Share Intelligence"
            >
              <span className="material-symbols-outlined text-lg">share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
