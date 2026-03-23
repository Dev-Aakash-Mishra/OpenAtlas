import { Handle, Position } from '@xyflow/react';
import './EventNode.css';

export default function EventNode({ data }) {
  const {
    id,
    content,
    domain,
    key_elements,
    color,
    connectionCount,
    speculation,
    confidence,
    trust_score,
    bias_warning,
    image_url,
    isPinned,
    onTogglePin
  } = data;

  const truncated = content?.length > 120
    ? content.slice(0, 120) + '…'
    : content;

  const topKeys = (key_elements || []).slice(0, 4);

  return (
    <div
      className={`event-node ${data.isSearchMatch ? 'search-match' : ''} ${isPinned ? 'is-pinned' : ''}`}
      style={{
        borderColor: color,
        boxShadow: isPinned ? `0 0 25px #eab30866, inset 0 0 35px #eab30844` : `0 0 20px ${color}22, inset 0 0 30px ${color}08`,
        borderWidth: isPinned ? '2px' : '1px'
      }}
    >
      <Handle type="target" position={Position.Top} className="node-handle" style={{ background: color }} />

      <div className="node-header">
        <span className="node-domain" style={{ background: `${color}20`, color }}>
          {domain}
        </span>
        
        {trust_score !== undefined && (
          <span className="node-trust" style={{ 
            fontSize: '9px', padding: '2px 6px', borderRadius: '4px', marginLeft: 'auto',
            background: trust_score >= 80 ? '#166534' : trust_score < 40 ? '#991b1b' : '#854d0e',
            color: 'white', fontWeight: 'bold'
          }}>
            🛡️ {trust_score}
          </span>
        )}
        {bias_warning && <span style={{ fontSize: '9px', marginLeft: '4px' }} title="High Bias Detected">⚠️</span>}

        <button 
          onClick={(e) => { e.stopPropagation(); if(onTogglePin) onTogglePin(id); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px',
            opacity: isPinned ? 1 : 0.3, fontSize: '13px'
          }}
          title={isPinned ? "Unpin Node" : "Pin Node"}
        >
          📌
        </button>
      </div>

      <p className="node-content">
        {image_url && (
          <img 
            src={image_url} 
            alt="Thumbnail" 
            style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '4px', marginBottom: '8px' }} 
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
        {truncated}
      </p>

      <div className="node-tags">
        {topKeys.map((k) => (
          <span key={k} className="node-tag">{k}</span>
        ))}
        {key_elements?.length > 4 && (
          <span className="node-tag node-tag-more">+{key_elements.length - 4}</span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="node-handle" style={{ background: color }} />
    </div>
  );
}
