import React, { useMemo } from 'react';
import { useViewport, useNodes } from '@xyflow/react';

const HEAT_RADIUS = 300; // Radius of the "nebula" for each node
const GRID_SIZE = 200; // Size of grid cell to cluster heat

export default function PhenomenonHeatmap({ active }) {
  const { x: viewX, y: viewY, zoom } = useViewport();
  const nodes = useNodes();

  // Calculate clusters of "heat" to avoid many overlapping DOM elements
  const heatSources = useMemo(() => {
    if (!nodes.length) return [];
    // 1. Calculate individual node tension
    const sources = nodes.map(n => {
      const { sentiment = 0, trust_score = 50, bias_warning = false, size = 160 } = n.data || {};
      
      // Tension score: 0 to 1
      // High tension = extreme sentiment (far from 0), low trust, or bias warning
      const tension = Math.min(
        (Math.abs(sentiment) * 0.4) + 
        ((100 - trust_score) / 100 * 0.4) + 
        (bias_warning ? 0.2 : 0), 1
      );

      return {
        id: n.id,
        x: n.position.x + size / 2,
        y: n.position.y + size / 2,
        tension,
        domain: n.data.domain
      };
    });

    // 2. Identify "hotspots" - areas with high density or high aggregate tension
    // For simplicity, we'll just use the high-tension nodes as centers of nebulae
    // and maybe add centers in high-density areas.
    return sources.filter(s => s.tension > 0.4); 
  }, [nodes]);

  if (!active || !heatSources.length) return null;

  return (
    <div className="phenomenon-heatmap-layer" style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: -1,
      overflow: 'hidden',
      transform: `translate(${viewX}px, ${viewY}px) scale(${zoom})`,
      transformOrigin: '0 0',
      transition: 'opacity 0.5s ease',
      opacity: active ? 1 : 0
    }}>
      <svg width="10000" height="10000" style={{ position: 'absolute', left: -5000, top: -5000 }}>
        <defs>
          <filter id="nebula-blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="60" />
          </filter>
          <radialGradient id="tension-gradient">
            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.4)" />
            <stop offset="60%" stopColor="rgba(239, 68, 68, 0.1)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0)" />
          </radialGradient>
          <radialGradient id="neutral-gradient">
            <stop offset="0%" stopColor="rgba(139, 92, 246, 0.3)" />
            <stop offset="60%" stopColor="rgba(139, 92, 246, 0.08)" />
            <stop offset="100%" stopColor="rgba(139, 92, 246, 0)" />
          </radialGradient>
        </defs>

        {heatSources.map((source, i) => {
          const isHighTension = source.tension > 0.6;
          const radius = HEAT_RADIUS * (0.8 + source.tension * 0.5);
          
          return (
            <circle
              key={source.id + i}
              cx={source.x + 5000}
              cy={source.y + 5000}
              r={radius}
              fill={isHighTension ? 'url(#tension-gradient)' : 'url(#neutral-gradient)'}
              filter="url(#nebula-blur)"
              className="heat-nebula"
              style={{
                mixBlendMode: 'screen',
                animation: `pulse-heat ${4 + Math.random() * 2}s infinite alternate ease-in-out`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
