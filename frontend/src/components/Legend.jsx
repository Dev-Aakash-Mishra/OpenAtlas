import './Legend.css';

export default function Legend({ domains, colors }) {
  return (
    <div className="legend">
      <h4 className="legend-title">Domains</h4>
      <div className="legend-items">
        {domains.map((d) => (
          <div key={d} className="legend-item">
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
