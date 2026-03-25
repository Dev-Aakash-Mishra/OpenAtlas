import { DOMAIN_COLORS } from '../constants';

export function layoutNodes(graphData) {
  const connectionCount = {};
  graphData.forEach((n) => {
    connectionCount[n.id] = (n.next?.length || 0) + (n.prev?.length || 0);
  });

  // Sort by timestamp so new nodes appear at the end of the spiral, keeping existing nodes stable
  const sorted = [...graphData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const nodes = [];
  const pseudoRandom = (s) => (Math.abs(s.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0)) % 1000) / 1000;

  sorted.forEach((n, i) => {
    const conns = connectionCount[n.id] || 0;

    // Golden Spiral Layout (Phyllotaxis) ensures perfect density and no overlaps
    const angle = i * 2.39996;
    const radius = 350 * Math.sqrt(i);

    // Organic deterministic noise
    const noiseX = (pseudoRandom(n.id + "x") - 0.5) * 80;
    const noiseY = (pseudoRandom(n.id + "y") - 0.5) * 80;

    const x = Math.cos(angle) * radius + noiseX;
    const y = Math.sin(angle) * radius + noiseY;

    const size = Math.min(Math.max(conns * 15 + 160, 160), 300);

    nodes.push({
      id: n.id,
      type: 'event',
      position: { x, y },
      data: {
        ...n,
        color: DOMAIN_COLORS[n.domain] || '#6b7280',
        connectionCount: conns,
        size,
      },
      style: { width: size, zIndex: conns },
    });
  });

  return nodes;
}

export function buildEdges(graphData) {
  const edges = [];
  const seen = new Set();

  graphData.forEach((node) => {
    (node.next || []).forEach((targetId) => {
      const key = `${node.id}->${targetId}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({
          id: key,
          source: node.id,
          target: targetId,
          animated: true,
          style: {
            stroke: DOMAIN_COLORS[node.domain] || '#6b7280',
            strokeWidth: 2,
            opacity: 0.6,
          },
        });
      }
    });
  });

  return edges;
}
