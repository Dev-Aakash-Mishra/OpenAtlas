export default function Legend({ domains, colors, currentFilter, onFilterChange }) {
  return (
    <div className="legend-container absolute bottom-6 left-6 z-30 p-4 bg-surface-container-low/60 backdrop-blur-xl border border-outline-variant/15 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h4 className="text-[10px] font-headline uppercase tracking-[0.2em] text-on-surface-variant mb-3 font-bold">Domain Legend</h4>
      <div className="space-y-2">
        <div 
          className={`flex items-center gap-3 cursor-pointer transition-all ${currentFilter === 'all' ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-100'}`}
          onClick={() => onFilterChange('all')}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-outline-variant"></span>
          <span className="text-xs text-on-surface/80">All Domains</span>
        </div>
        
        {domains.map((d) => (
          <div 
            key={d} 
            className={`flex items-center gap-3 cursor-pointer transition-all ${currentFilter === d ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-100'}`}
            onClick={() => onFilterChange(d === currentFilter ? 'all' : d)}
          >
            <span 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: colors[d] || '#62fae3' }}
            ></span>
            <span className="text-xs text-on-surface/80">
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
