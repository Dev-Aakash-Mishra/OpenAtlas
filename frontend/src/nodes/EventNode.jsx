import { Handle, Position } from '@xyflow/react';
import './EventNode.css';

export default function EventNode({ data }) {
  const {
    content,
    domain,
    key_elements,
    color,
    connectionCount,
    speculation,
    confidence,
  } = data;

  const truncated = content?.length > 120
    ? content.slice(0, 120) + '…'
    : content;

  const topKeys = (key_elements || []).slice(0, 4);

  return (
    <div
      className="event-node"
      style={{
        borderColor: color,
        boxShadow: `0 0 20px ${color}22, inset 0 0 30px ${color}08`,
      }}
    >
      <Handle type="target" position={Position.Top} className="node-handle" style={{ background: color }} />

      <div className="node-header">
        <span className="node-domain" style={{ background: `${color}20`, color }}>
          {domain}
        </span>
        {speculation && (
          <span className="node-speculation" title={`Confidence: ${confidence}`}>
            ⚡ {Math.round((confidence || 0) * 100)}%
          </span>
        )}
        {connectionCount > 0 && (
          <span className="node-connections" style={{ color }}>
            {connectionCount} links
          </span>
        )}
      </div>

      <p className="node-content">{truncated}</p>

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
