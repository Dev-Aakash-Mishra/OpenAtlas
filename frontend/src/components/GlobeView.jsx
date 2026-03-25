import { useRef, useEffect, useState } from 'react';
import Globe from 'react-globe.gl';

export default function GlobeView({ graphData, DOMAIN_COLORS }) {
  const globeEl = useRef();
  const [arcsData, setArcsData] = useState([]);
  const [pointsData, setPointsData] = useState([]);

  useEffect(() => {
    // Filter nodes that actually have lat/lng
    const geoNodes = graphData.filter(n => n.lat !== undefined && n.lng !== undefined && n.lat !== null && !isNaN(n.lat));
    
    const nodeMap = new Map();
    geoNodes.forEach(n => nodeMap.set(n.id, n));

    const arcs = [];
    geoNodes.forEach(node => {
      (node.next || []).forEach(targetId => {
        const targetNode = nodeMap.get(targetId);
        if (targetNode) {
          arcs.push({
            startLat: node.lat,
            startLng: node.lng,
            endLat: targetNode.lat,
            endLng: targetNode.lng,
            color: DOMAIN_COLORS[node.domain] || '#ffffff'
          });
        }
      });
    });

    setPointsData(geoNodes.map(n => ({
      ...n,
      size: Math.max(0.5, ((n.next?.length || 0) + (n.prev?.length || 0)) * 0.2 + 0.5),
      color: DOMAIN_COLORS[n.domain] || '#ffffff',
      label: n.content?.length > 40 ? n.content.substring(0, 40) + '...' : n.content
    })));
    setArcsData(arcs);

    if (globeEl.current) {
       globeEl.current.controls().autoRotate = true;
       globeEl.current.controls().autoRotateSpeed = 0.5;
    }
  }, [graphData, DOMAIN_COLORS]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {pointsData.length > 0 ? (
        <Globe
          ref={globeEl}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          arcsData={arcsData}
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2500}
          pointsData={pointsData}
          pointColor="color"
          pointAltitude="size"
          pointRadius="size"
          pointLabel="label"
        />
      ) : (
        <div style={{ color: 'white', textAlign: 'center' }}>
          <h2>Globe View Pending</h2>
          <p style={{ color: '#94a3b8' }}>Waiting for the active AI worker to ingest live news articles containing geographic coordinates.</p>
        </div>
      )}
    </div>
  );
}
