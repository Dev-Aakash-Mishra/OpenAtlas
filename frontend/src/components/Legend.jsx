import { useState } from 'react';

export default function Legend({ domains, colors, currentFilter, onFilterChange }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`legend-container absolute bottom-6 left-6 z-30 transition-all duration-500 ease-in-out ${isCollapsed ? 'w-10 h-10 p-0 rounded-full' : 'p-4 rounded-xl w-48'} bg-surface-container-low/60 backdrop-blur-xl border border-outline-variant/15 shadow-2xl overflow-hidden`}>
      <div className={`flex items-center ${isCollapsed ? 'justify-center w-full h-full' : 'justify-between mb-4 px-1'}`}>
        {!isCollapsed && (
          <h4 className="text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant font-bold">Legend</h4>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`flex items-center justify-center rounded-lg transition-colors ${isCollapsed ? 'w-full h-full hover:bg-white/5' : 'w-6 h-6 hover:bg-white/5 text-on-surface-variant/50 hover:text-white'}`}
          title={isCollapsed ? 'Expand Legend' : 'Collapse Legend'}
        >
          <span className={`material-symbols-outlined text-[18px] transition-transform duration-500 ${isCollapsed ? '' : 'rotate-180'}`}>
            {isCollapsed ? 'list' : 'chevron_left'}
          </span>
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-2.5 animate-in fade-in slide-in-from-left-2 duration-500">
          <div 
            className={`flex items-center gap-3 cursor-pointer group transition-all ${currentFilter === 'all' ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
            onClick={() => onFilterChange('all')}
          >
            <div className={`w-2 h-2 rounded-full border-2 transition-all ${currentFilter === 'all' ? 'bg-white border-white' : 'bg-transparent border-outline-variant group-hover:border-white'}`} />
            <span className="text-[11px] font-bold text-on-surface/80 group-hover:text-white transition-colors">All Sectors</span>
          </div>
          
          {domains.map((d) => (
            <div 
              key={d} 
              className={`flex items-center gap-3 cursor-pointer group transition-all ${currentFilter === d ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
              onClick={() => onFilterChange(d === currentFilter ? 'all' : d)}
            >
              <div 
                className={`w-2 h-2 rounded-full transition-all ${currentFilter === d ? 'scale-125 ring-4 ring-offset-2 ring-offset-transparent' : 'group-hover:scale-110'}`} 
                style={{ 
                  backgroundColor: colors[d] || '#62fae3',
                  boxShadow: currentFilter === d ? `0 0 12px ${colors[d]}66` : 'none',
                  '--ring-color': colors[d]
                }}
              />
              <span className="text-[11px] font-bold text-on-surface/80 group-hover:text-white transition-colors">
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
