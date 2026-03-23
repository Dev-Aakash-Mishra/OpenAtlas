import './DetailPanel.css';

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

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-domain-row">
          <span
            className="detail-domain"
            style={{ background: `${domainColor}20`, color: domainColor, borderColor: `${domainColor}40` }}
          >
            {domain}
          </span>
          {speculation && (
            <span className="detail-spec">
              ⚡ Speculative — {Math.round((confidence || 0) * 100)}% confidence
            </span>
          )}
        </div>
        <button className="detail-close" onClick={onClose}>✕</button>
      </div>

      <p className="detail-content">{content}</p>

      <div className="detail-section">
        <h3 className="detail-section-title">Key Elements</h3>
        <div className="detail-tags">
          {(key_elements || []).map((k) => (
            <span key={k} className="detail-tag" style={{ borderColor: `${domainColor}30` }}>
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="detail-section">
        <h3 className="detail-section-title">Connections</h3>
        <div className="detail-connections">
          <div className="detail-conn">
            <span className="detail-conn-label">Outgoing</span>
            <span className="detail-conn-value" style={{ color: domainColor }}>
              {next?.length || 0}
            </span>
          </div>
          <div className="detail-conn">
            <span className="detail-conn-label">Incoming</span>
            <span className="detail-conn-value" style={{ color: domainColor }}>
              {prev?.length || 0}
            </span>
          </div>
        </div>
        
        {isGhost ? (
          <button 
            className="detail-thread-btn"
            onClick={() => onMaterialize(node)}
            style={{ width: '100%', marginTop: '12px', padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            ✨ Materialize to Graph
          </button>
        ) : (
          <>
            <button 
              className="detail-thread-btn"
              onClick={() => onFollowThread(id)}
              style={{ width: '100%', marginTop: '12px', padding: '10px', background: domainColor, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              🧶 Follow Narrative Thread
            </button>

            <button 
              className="detail-thread-btn"
              onClick={() => onPredictBranch(id)}
              style={{ width: '100%', marginTop: '8px', padding: '10px', background: 'transparent', color: domainColor, border: `1px solid ${domainColor}80`, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              🔮 Predict Future Consequences
            </button>
          </>
        )}
      </div>

      <div className="detail-meta">
        <span className="detail-meta-item">
          {new Date(timestamp).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })}
        </span>
        <span className="detail-meta-item detail-id" title={id}>
          {id.slice(0, 8)}…
        </span>
        {source_url && (
          <a 
            href={source_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="detail-source-link"
            style={{ color: domainColor, marginLeft: 'auto', textDecoration: 'none', fontWeight: '500' }}
          >
            Read Source ↗
          </a>
        )}
      </div>
    </div>
  );
}
