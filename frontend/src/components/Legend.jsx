import './Legend.css';

export default function Legend({ domains, colors, currentFilter, onFilterChange }) {
  return (
    <div className="legend">
      <h4 className="legend-title">Domains</h4>
      <div className="legend-items">
        <div 
          className={`legend-item ${currentFilter === 'all' ? 'active' : ''}`}
          onClick={() => onFilterChange('all')}
          style={{ cursor: 'pointer', opacity: currentFilter === 'all' ? 1 : 0.6 }}
        >
          <span className="legend-dot" style={{ background: '#94a3b8' }} />
          <span className="legend-label">All</span>
        </div>
        {domains.map((d) => (
          <div 
            key={d} 
            className={`legend-item ${currentFilter === d ? 'active' : ''}`}
            onClick={() => onFilterChange(d === currentFilter ? 'all' : d)}
            style={{ 
              cursor: 'pointer', 
              opacity: currentFilter === 'all' || currentFilter === d ? 1 : 0.3,
              transition: 'opacity 0.2s ease'
            }}
          >
            <span
              className="legend-dot"
              style={{ background: colors[d] || '#6b7280' }}
            />
            <span className="legend-label">
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
