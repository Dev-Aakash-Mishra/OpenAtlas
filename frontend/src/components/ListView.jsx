import React from 'react';

const ListView = ({ nodes, onNodeClick, domainColors }) => {
  const displayNodes = nodes.filter(n => !n.data.isGhost).slice().reverse();
  
  const handleShare = (e, node) => {
    e.stopPropagation();
    const headline = node.data.content?.split('.')[0] || 'News';
    const url = node.data.source_url || window.location.href;
    const text = `${headline}\n\nRead more: ${url}\n\n— via OpenAtlas`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="absolute inset-0 z-30 p-4 md:p-12 overflow-y-auto bg-[#0b0e14]/30 backdrop-blur-sm animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
          <h2 className="text-xl md:text-3xl font-headline font-bold text-primary uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl md:text-4xl text-primary/80">view_agenda</span>
            News Feed
          </h2>
          <div className="px-3 py-1.5 bg-secondary/10 border border-secondary/20 rounded-full text-[11px] font-bold text-secondary uppercase tracking-widest">
            {displayNodes.length} Stories
          </div>
        </div>
        
        {displayNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center bg-surface-container-high/40 rounded-[2.5rem] border border-outline-variant/10 backdrop-blur-sm px-6">
            <div className="w-20 h-20 md:w-24 md:h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <span className="material-symbols-outlined text-4xl md:text-5xl text-primary/60">newspaper</span>
            </div>
            <h3 className="text-xl md:text-2xl font-headline font-bold text-on-surface mb-3 tracking-tight">The Atlas is currently quiet.</h3>
            <p className="text-sm text-on-surface-variant/70 max-w-md leading-relaxed mb-8">
              No recent events have been detected in this region. Click the refresh button in the sidebar to scan for the latest global and regional shifts.
            </p>
            <div className="flex gap-4">
               <div className="h-px w-12 bg-outline-variant/20 self-center"></div>
               <span className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-[0.3em]">Open Atlas Feeds</span>
               <div className="h-px w-12 bg-outline-variant/20 self-center"></div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {displayNodes.map((node) => (
              <div 
                key={node.id} 
                className="relative p-4 md:p-6 bg-surface-container-high/60 border border-outline-variant/10 rounded-xl md:rounded-2xl hover:border-primary/40 transition-all cursor-pointer group shadow-lg"
                onClick={() => onNodeClick(node.id)}
              >
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                  <span className="text-[11px] font-headline font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-white" style={{ backgroundColor: domainColors[node.data.domain] }}>
                    {node.data.domain}
                  </span>
                  <span className="text-on-surface-variant text-[11px] font-medium">
                    {new Date(node.data.timestamp).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                  </span>
                  {node.data.state && (
                    <span className="flex items-center gap-1 text-[11px] text-secondary font-bold uppercase tracking-tighter">
                      <span className="material-symbols-outlined text-xs">location_on</span>
                      {node.data.district ? `${node.data.district}, ${node.data.state}` : node.data.state}
                    </span>
                  )}
                  {node.data.region === 'India' && !node.data.state && (
                    <span className="flex items-center gap-1 text-[11px] text-secondary font-bold uppercase tracking-tighter">
                      🇮🇳 India
                    </span>
                  )}
                  {/* Share to WhatsApp */}
                  <button 
                    className="ml-auto p-1.5 rounded-lg hover:bg-green-500/10 text-on-surface-variant/50 hover:text-green-500 transition-colors"
                    onClick={(e) => handleShare(e, node)}
                    title="Share via WhatsApp"
                  >
                    <span className="material-symbols-outlined text-base">share</span>
                  </button>
                </div>
                <h4 className="text-base md:text-lg font-headline font-bold text-on-surface group-hover:text-primary transition-colors leading-tight mb-2">
                  {node.data.content?.split('.')[0]}
                </h4>
                <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity whitespace-pre-wrap">
                  {node.data.content}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(node.data.key_elements || []).slice(0, 5).map(key => (
                    <span key={key} className="text-[11px] px-1.5 py-0.5 bg-surface-container-highest rounded text-on-surface-variant border border-outline-variant/5">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

  );
};

export default ListView;
