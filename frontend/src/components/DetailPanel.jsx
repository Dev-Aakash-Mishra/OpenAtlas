import { useState } from 'react';

export default function DetailPanel({ 
  node, 
  onClose, 
  domainColor, 
  onFollowThread, 
  onPredictBranch, 
  onMaterialize,
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

  const handleDeepDive = () => {
    setLoadingDeepDive(true);
    fetch(`/api/deep_dive/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setDeepDive(data.analysis);
        } else {
          showToast("Deep dive failed: " + data.message, 'error');
        }
      })
      .catch(err => console.error("Deep dive error", err))
      .finally(() => setLoadingDeepDive(false));
  };

  return (
    <div className="absolute top-6 right-4 md:right-6 z-50 w-[calc(100%-2rem)] sm:w-80 bg-surface-container-high/90 backdrop-blur-2xl border border-outline-variant/15 rounded-2xl shadow-2xl p-5 md:p-6 animate-in slide-in-from-right-8 duration-300 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin scrollbar-thumb-outline-variant/30 scrollbar-track-transparent">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-headline font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-wider">
          {isGhost ? 'Expert Prediction' : 'Event Details'}
        </span>
        <button onClick={onClose} className="hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant text-sm">close</span>
        </button>
      </div>

      {/* Publisher Badge - prominent at top */}
      {publisher && (
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">newsmode</span>
          <span className="text-[11px] font-bold text-on-surface uppercase tracking-wide">{publisher}</span>
          {trust_score !== undefined && (
            <span className={`ml-auto text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
              bias_warning ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' :
              trust_score >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
              'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
            }`}>
              {bias_warning ? '⚠ Tone Warning' : `Fact-Checked ${trust_score}%`}
            </span>
          )}
        </div>
      )}

      <h2 className="text-xl font-headline font-bold mb-2 leading-tight">{content?.split('.')[0]}</h2>
      <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
        {content}
      </p>

      {state && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-full text-[9px] font-bold text-secondary uppercase tracking-wider">
            <span className="material-symbols-outlined text-[12px]">location_on</span>
            {district ? `${district}, ${state}` : state}
          </span>
        </div>
      )}

      {local_relevance && (
        <div className="mb-4 p-4 bg-secondary/5 border-l-2 border-secondary rounded-r-xl shadow-inner">
           <h5 className="text-[9px] font-headline text-secondary uppercase tracking-widest mb-1 font-bold">Local Relevance (India)</h5>
           <p className="text-[11px] font-medium text-on-surface leading-relaxed">
             {local_relevance}
           </p>
        </div>
      )}

      {/* Mini-Map for geo-tagged events */}
      {lat && lng && (
        <div className="mb-4 rounded-xl overflow-hidden border border-outline-variant/20 shadow-inner">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-container-highest">
            <span className="material-symbols-outlined text-[12px] text-on-surface-variant">location_on</span>
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Event Location</span>
            <span className="ml-auto text-[11px] text-on-surface-variant">{lat >= 0 ? `${lat?.toFixed(2)}°N` : `${Math.abs(lat)?.toFixed(2)}°S`}, {lng >= 0 ? `${lng?.toFixed(2)}°E` : `${Math.abs(lng)?.toFixed(2)}°W`}</span>
          </div>
          <iframe
            title="Event Location"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng-2},${lat-2},${lng+2},${lat+2}&layer=mapnik&marker=${lat},${lng}`}
            className="w-full h-32 border-0"
            loading="lazy"
          />
        </div>
      )}

      {deepDive && (
        <div className="mb-6 relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <div className="relative p-5 bg-surface-container-highest/90 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-xl overflow-hidden">
             {/* Quantum Circuit Mesh Background */}
             <div className="absolute inset-0 opacity-5 pointer-events-none">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <pattern id="mesh" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5"/>
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#mesh)" />
                </svg>
             </div>

             <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-sm animate-spin-slow">psychology</span>
                <h5 className="text-[11px] font-headline text-primary uppercase tracking-[0.2em] font-bold">AI Deep Analysis</h5>
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
              Save to Feed
            </button>
          ) : (
            <>
              <button 
                className={`w-full bg-primary text-on-primary font-bold py-3 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-xs shadow-lg shadow-primary/20 ${isProcessingThread ? 'cursor-wait opacity-80' : ''}`}
                onClick={() => onFollowThread(id)}
                disabled={isProcessingThread}
              >
                <span className={`material-symbols-outlined text-sm ${isProcessingThread ? 'animate-spin' : ''}`}>
                  {isProcessingThread ? 'progress_activity' : 'account_tree'}
                </span>
                {isProcessingThread ? 'Processing Thread...' : 'Follow Narrative Thread'}
              </button>
              <button 
                className={`w-full bg-surface-container-highest border border-outline-variant/20 text-on-surface font-bold py-3 rounded-xl hover:bg-surface-variant transition-all flex items-center justify-center gap-2 text-xs ${isPredicting ? 'cursor-wait opacity-80' : ''}`}
                onClick={() => onPredictBranch(id)}
                disabled={isPredicting}
              >
                <span className={`material-symbols-outlined text-sm ${isPredicting ? 'animate-spin' : ''}`}>
                  {isPredicting ? 'progress_activity' : 'online_prediction'}
                </span>
                {isPredicting ? 'Predicting...' : 'Predict Consequences'}
              </button>
            </>
          )}
          
          <button 
            className="w-full py-2 text-[10px] text-primary hover:text-primary-dim transition-colors flex items-center justify-center gap-1 font-bold tracking-tight"
            onClick={handleDeepDive}
            disabled={loadingDeepDive}
          >
            <span className="material-symbols-outlined text-xs">{loadingDeepDive ? 'hourglass_empty' : 'psychology'}</span>
            {loadingDeepDive ? 'Analyzing...' : 'AI Deep Analysis'}
          </button>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
        <span className="text-[9px] text-on-surface-variant font-medium">{new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        {source_url && (
          <a href={source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] text-primary hover:underline font-bold">
            {publisher ? publisher : 'Source'}
            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
          </a>
        )}
        {/* WhatsApp Share */}
        <button 
          className="p-1.5 rounded-lg hover:bg-green-500/10 text-on-surface-variant/50 hover:text-green-500 transition-colors"
          onClick={() => {
            const headline = content?.split('.')[0] || 'News';
            const url = source_url || window.location.href;
            const text = `${headline}\n\nRead more: ${url}\n\n— via OpenAtlas`;
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
          }}
          title="Share via WhatsApp"
        >
          <span className="material-symbols-outlined text-sm">share</span>
        </button>
      </div>
    </div>
  );
}
