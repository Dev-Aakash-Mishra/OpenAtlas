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
    <div style={{ width: '100%', height: '100%', background: '#0c0e12', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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
        <div className="text-center p-12 glass-panel border border-white/10 rounded-2xl max-w-md">
          <h2 className="text-[11px] font-label font-black text-primary uppercase tracking-[0.4em] mb-6">Globe Interface Offline</h2>
          <p className="text-on-surface text-lg font-headline italic font-bold leading-relaxed mb-8">
            Awaiting the ingestion of live geospatial intelligence nodes.
          </p>
          <div className="flex justify-center">
             <div className="w-px h-12 bg-white/10 animate-pulse"></div>
          </div>
        </div>
      )}
    </div>
  );
}
