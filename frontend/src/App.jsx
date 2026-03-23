import { useState, useEffect, useCallback, useMemo } from 'react';
import React from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EventNode from './nodes/EventNode';
import DetailPanel from './components/DetailPanel';
import Legend from './components/Legend';
import ChatPanel from './components/ChatPanel';
import GlobeView from './components/GlobeView';
import PhenomenonHeatmap from './components/PhenomenonHeatmap';
import './App.css';

const API_BASE = '';
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const DEFAULT_FONT_IDX = 2;

const DOMAIN_COLORS = {
  geopolitics: '#ef4444',
  economics: '#f59e0b',
  military: '#dc2626',
  technology: '#06b6d4',
  environment: '#22c55e',
  society: '#a855f7',
  science: '#3b82f6',
  culture: '#ec4899',
  sports: '#f97316',
  health: '#14b8a6',
  politics: '#8b5cf6',
};

const nodeTypes = { event: EventNode };

function layoutNodes(graphData) {
  const connectionCount = {};
  graphData.forEach((n) => {
    connectionCount[n.id] = (n.next?.length || 0) + (n.prev?.length || 0);
  });

  // Sort strictly by ID so the layout doesn't violently shuffle when live nodes are added
  const sorted = [...graphData].sort((a, b) => a.id.localeCompare(b.id));

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

function buildEdges(graphData) {
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

function GraphView() {
  const { setCenter } = useReactFlow();
  const { zoom } = useViewport();
  const [graphData, setGraphData] = useState([]);
  const [viewMode, setViewMode] = useState('2d');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [fontIdx, setFontIdx] = useState(DEFAULT_FONT_IDX);
  const [healthStatus, setHealthStatus] = useState('ok');
  const [focusedNodeId, setFocusedNodeId] = useState(null);
  const [nodeLimit, setNodeLimit] = useState(150);
  const [pinnedNodes, setPinnedNodes] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('openatlas_pinned')) || []); }
    catch { return new Set(); }
  });
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [narrativeThread, setNarrativeThread] = useState(null);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [ghostNodes, setGhostNodes] = useState([]);

  const togglePin = useCallback((id) => {
    // Ghost nodes cannot be pinned
    if (String(id).startsWith('ghost_')) return;
    setPinnedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('openatlas_pinned', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const fontSize = FONT_SIZES[fontIdx];

  const fetchGraph = useCallback(() => {
    fetch(`${API_BASE}/api/health`)
      .then(res => setHealthStatus(res.ok ? 'ok' : 'error'))
      .catch(() => setHealthStatus('error'));

    fetch(`${API_BASE}/api/graph`)
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        setGraphData(prev => {
          // Only update state if length or items actually changed to avoid layout thrashing
          return data.length !== prev.length ? data : prev;
        });
      })
      .catch(() => {
        fetch('/graph.json')
          .then((r) => r.json())
          .then((data) => {
            if (!Array.isArray(data)) return;
            setGraphData(prev => data.length !== prev.length ? data : prev);
          }).catch(() => { });
      });
  }, []);

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [fetchGraph]);

  useEffect(() => {
    if (!graphData.length && !ghostNodes.length) return;

    const combinedData = [...graphData, ...ghostNodes];
    let baseNodes = combinedData;

    if (filterDomain !== 'all') {
      baseNodes = combinedData.filter((n) => n.domain === filterDomain || n.isGhost);
    }

    if (showPinnedOnly) {
      baseNodes = combinedData.filter(n => 
        pinnedNodes.has(n.id) || 
        (n.next || []).some(id => pinnedNodes.has(id)) || 
        (n.prev || []).some(id => pinnedNodes.has(id))
      );
    } else {
      // Time-Slider Limit applies primarily when viewing global feed
      const ghostCount = ghostNodes.length;
      baseNodes = [
        ...graphData.slice(-(nodeLimit - ghostCount)),
        ...ghostNodes
      ];
    }
    
    const recentIds = new Set(baseNodes.map(n => n.id));
    
    // Build an isolated copy of baseNodes so we scrub dead edges locally
    baseNodes = baseNodes.map(n => {
       const next = (n.next || []).filter(id => recentIds.has(id));
       // Add ghost edges if this is a predictions source
       ghostNodes.forEach(gn => {
          if (gn.source_id === n.id) next.push(gn.id);
       });
       return {
          ...n,
          next: next,
          prev: (n.prev || []).filter(id => recentIds.has(id))
       };
    });

    const matchSet = new Set(
      searchQuery.trim() ? 
        baseNodes.filter(n => {
          const q = searchQuery.toLowerCase();
          return n.content.toLowerCase().includes(q) || (n.key_elements || []).some(k => k.toLowerCase().includes(q));
        }).map(n => n.id) : 
        []
    );

    const newNodes = layoutNodes(baseNodes);
    newNodes.forEach(n => {
      n.data.isSearchMatch = matchSet.has(n.id);
      n.data.isPinned = pinnedNodes.has(n.id);
      n.data.onTogglePin = togglePin;
      n.data.id = n.id;
      
      const sourceNode = baseNodes.find(bn => bn.id === n.id);
      if (sourceNode?.isGhost) n.data.isGhost = true;
    });

    setNodes(newNodes);
    setEdges(buildEdges(baseNodes));
  }, [graphData, ghostNodes, filterDomain, searchQuery, nodeLimit, showPinnedOnly, pinnedNodes, togglePin]);

  useEffect(() => {
    if (!graphData.length) return;

    // Persist focus state if a node is actively opened, fallback to hover otherwise
    const activeFocusId = selectedNode?.id || focusedNodeId;
    const threadIds = new Set((narrativeThread && narrativeThread.path) || []);

    setNodes((nds) => nds.map((n) => {
      let isFocused = false;
      let isDimmed = false;
      let isThreadNode = threadIds.has(n.id);
      let isGhostNode = n.data?.isGhost;
      
      if (activeFocusId) {
        const focusedData = [...graphData, ...ghostNodes].find(gd => gd.id === activeFocusId);
        if (focusedData) {
          const connectedIds = new Set([activeFocusId, ...(focusedData.next || []), ...(focusedData.prev || [])]);
          // Add ghost links
          if (focusedData.isGhost && focusedData.source_id) connectedIds.add(focusedData.source_id);
          [...graphData, ...ghostNodes].forEach(gn => {
             if (gn.source_id === activeFocusId) connectedIds.add(gn.id);
          });

          isFocused = connectedIds.has(n.id);
          isDimmed = !isFocused;
        }
      }
      
      // If a narrative thread is active, emphasize it above all else
      if (narrativeThread) {
        isDimmed = !isThreadNode;
      }

      const targetQuery = searchQuery?.trim() || '';
      const searchDimmed = targetQuery && !n.data.isSearchMatch;
      const searchGlow = targetQuery && n.data.isSearchMatch;

      const baseOpacity = isDimmed || searchDimmed ? (isGhostNode ? 0.05 : 0.2) : (isGhostNode ? 0.4 : 1);
      const isStrongGlow = isFocused || searchGlow || (narrativeThread && isThreadNode);

      return {
        ...n,
        style: {
          ...n.style,
          opacity: baseOpacity,
          filter: isStrongGlow ? `drop-shadow(0 0 22px ${isThreadNode ? '#fbbf24' : (isGhostNode ? '#8b5cf6' : 'rgba(255,255,255,0.6)')})` : 'none',
          borderWidth: isThreadNode ? '4px' : n.style.borderWidth,
          borderStyle: isGhostNode ? 'dashed' : 'solid',
          borderColor: isGhostNode ? '#8b5cf6' : n.style.borderColor,
          transition: 'all 0.4s ease'
        }
      };
    }));

    setEdges((eds) => eds.map((e) => {
      let isEdgeFocused = false;
      let isThreadEdge = false;
      let isGhostEdge = e.id.startsWith('edge-ghost-');
      
      if (narrativeThread && narrativeThread.path) {
        const path = narrativeThread.path;
        if (Array.isArray(path)) {
          for (let i = 0; i < path.length - 1; i++) {
            if (e.source === path[i] && e.target === path[i + 1]) {
              isThreadEdge = true;
              break;
            }
          }
        }
      }

      if (activeFocusId) {
        isEdgeFocused = e.source === activeFocusId || e.target === activeFocusId;
      }
      
      // Hover Focus Mode: default edges are very dim to un-clutter the view
      const op = narrativeThread ? (isThreadEdge ? 1 : 0.01) : (activeFocusId ? (isEdgeFocused ? 0.95 : 0.01) : (isGhostEdge ? 0.1 : 0.15));
      const sw = (narrativeThread && isThreadEdge) ? 4 : (activeFocusId && isEdgeFocused ? 3 : 1);
      
      return {
        ...e,
        animated: isEdgeFocused || !activeFocusId || isThreadEdge || isGhostEdge,
        style: {
          ...e.style,
          opacity: op,
          strokeWidth: sw,
          stroke: isThreadEdge ? '#fbbf24' : (isGhostEdge ? '#8b5cf6' : e.style.stroke),
          strokeDasharray: isGhostEdge ? '5,5' : 'none',
          transition: 'all 0.4s ease'
        }
      };
    }));
  }, [focusedNodeId, selectedNode, graphData, ghostNodes, searchQuery, setNodes, setEdges, narrativeThread]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data);
  }, []);

  const onNodeMouseEnter = useCallback((_, node) => {
    setFocusedNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  const handleNodeSelectFromChat = useCallback((nodeId) => {
    const nodeData = graphData.find((n) => n.id === nodeId || n.id.startsWith(nodeId));
    if (nodeData) {
      setSelectedNode({
        ...nodeData,
        color: DOMAIN_COLORS[nodeData.domain] || '#6b7280',
        connectionCount: (nodeData.next?.length || 0) + (nodeData.prev?.length || 0),
      });

      const rfNode = nodes.find(n => n.id === nodeData.id);
      if (rfNode) {
        setCenter(rfNode.position.x + rfNode.data.size / 2, rfNode.position.y + 100, { zoom: 1.2, duration: 800 });
      }
    }
  }, [graphData, nodes, setCenter]);

  const handleFollowThread = useCallback((nodeId) => {
    fetch(`${API_BASE}/api/narrative_thread/${nodeId}`)
      .then(res => res.json())
      .then(data => {
        setNarrativeThread(data);
        // Clear selection to focus on the thread
        setSelectedNode(null);
      })
      .catch(err => console.error("Narrative thread fetch failed", err));
  }, []);

  const handlePredictBranch = useCallback((nodeId) => {
    fetch(`${API_BASE}/api/predict_branch/${nodeId}`)
      .then(res => res.json())
      .then(data => {
        setGhostNodes(prev => [...prev, ...data]);
      })
      .catch(err => console.error("Ghost prediction failed", err));
  }, []);

  const handleMaterialize = useCallback((ghostNode) => {
    fetch(`${API_BASE}/api/materialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ghostNode)
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          // Remove the materialized ghost node and refresh graph
          setGhostNodes(prev => prev.filter(g => g.id !== ghostNode.id));
          fetchGraph();
          setSelectedNode(null);
        } else {
          alert("Materialization failed: " + data.message);
        }
      })
      .catch(err => console.error("Materialization error", err));
  }, [fetchGraph]);

  const domains = useMemo(() => {
    const s = new Set(graphData.map((n) => n.domain));
    return [...s].sort();
  }, [graphData]);

  const stats = useMemo(() => ({
    totalNodes: graphData.length,
    totalEdges: graphData.reduce((acc, n) => acc + (n.next?.length || 0), 0),
    domains: new Set(graphData.map((n) => n.domain)).size,
    speculative: graphData.filter((n) => n.speculation).length,
  }), [graphData]);

  return (
    <div className="app" style={{ '--global-font-size': `${fontSize}px` }}>
      <header className="header">
        <div className="header-left">
          <h1 className="title">
            <span className="title-icon">◉</span> OpenAtlas
          </h1>
          <span className="subtitle">Knowledge Graph Explorer</span>
        </div>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{stats.totalNodes}</span>
            <span className="stat-label">Nodes</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.totalEdges}</span>
            <span className="stat-label">Edges</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.domains}</span>
            <span className="stat-label">Domains</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.speculative}</span>
            <span className="stat-label">Speculative</span>
          </div>
        </div>
      </header>

      {healthStatus === 'error' && (
        <div style={{ background: '#dc2626', color: 'white', textAlign: 'center', padding: '8px', fontSize: '14px', fontWeight: '500' }}>
          ⚠️ Backend service is currently unreachable. Live updates and Atlas Chat will be unavailable.
        </div>
      )}
            <div className="toolbar">
        <div className="toolbar-group search-group" style={{ flex: 1, maxWidth: '400px' }}>
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search events, entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group data-controls">
          <div className="time-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>LIMIT</span>
            <input
              type="range"
              min="10" max="150" step="10"
              value={nodeLimit}
              onChange={(e) => setNodeLimit(Number(e.target.value))}
              style={{ width: '60px' }}
            />
            <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold', width: '24px' }}>{nodeLimit}</span>
          </div>
          
          <select
            className="domain-filter"
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            style={{ padding: '6px 12px', border: 'none', background: 'transparent' }}
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>

          <button
            className={`chat-toggle ${showPinnedOnly ? 'active' : ''}`}
            style={{ padding: '6px 12px', background: showPinnedOnly ? 'var(--accent)' : 'transparent', border: 'none' }}
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            title="Show only pinned nodes"
          >
            {showPinnedOnly ? '📌 Filtered' : '📌 Saved'}
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-controls" style={{ marginLeft: 'auto' }}>
          <div className="view-options-container">
            <button 
              className={`chat-toggle ${viewOptionsOpen ? 'active' : ''}`}
              onClick={() => setViewOptionsOpen(!viewOptionsOpen)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span>⚙️</span> View
            </button>
            
            {viewOptionsOpen && (
              <div className="view-options-dropdown">
                <div className="dropdown-section">
                  <span className="dropdown-label">Visuals</span>
                  <div className="dropdown-row">
                    <span className="control-label">Heatmap Layer</span>
                    <button 
                      className={`icon-btn ${heatEnabled ? 'active' : ''}`}
                      onClick={() => setHeatEnabled(!heatEnabled)}
                    >
                      {heatEnabled ? '🔥' : '❄️'}
                    </button>
                  </div>
                  <div className="dropdown-row">
                    <span className="control-label">Map Perspective</span>
                    <button 
                      className="icon-btn"
                      onClick={() => setViewMode(v => v === '2d' ? '3d' : '2d')}
                    >
                      {viewMode === '3d' ? '🌍' : '🗺️'}
                    </button>
                  </div>
                </div>

                <div className="dropdown-section">
                  <span className="dropdown-label">Typography</span>
                  <div className="dropdown-row">
                    <span className="control-label">System Font Size</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="icon-btn" onClick={() => setFontIdx(i => Math.max(0, i - 1))} disabled={fontIdx === 0}>-</button>
                      <button className="icon-btn" onClick={() => setFontIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))} disabled={fontIdx === FONT_SIZES.length - 1}>+</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!chatOpen && (
            <button
              className="chat-toggle"
              onClick={() => setChatOpen(true)}
              style={{ background: 'var(--accent)', color: 'white', border: 'none' }}
            >
              ◉ Atlas Chat
            </button>
          )}

          {ghostNodes.length > 0 && (
            <button
              className="chat-toggle"
              style={{ background: '#8b5cf620', color: '#8b5cf6', border: '1px solid #8b5cf644', marginLeft: '4px' }}
              onClick={() => setGhostNodes([])}
            >
              ✕ Clear Predictions
            </button>
          )}

          {narrativeThread && (
            <button
              className="chat-toggle"
              style={{ background: '#fbbf2420', color: '#fbbf24', border: '1px solid #fbbf2444' }}
              onClick={() => setNarrativeThread(null)}
            >
              ✕ Clear Thread
            </button>
          )}
        </div>
      </div>

      <div className={`canvas-wrapper ${zoom < 0.6 ? 'semantic-zoom' : ''}`}>
        <div style={{ position: 'absolute', inset: 0, zIndex: viewMode === '3d' ? 10 : -1, opacity: viewMode === '3d' ? 1 : 0, pointerEvents: viewMode === '3d' ? 'auto' : 'none', transition: 'opacity 0.5s ease' }}>
          <GlobeView graphData={graphData} DOMAIN_COLORS={DOMAIN_COLORS} />
        </div>
        <div style={{ width: '100%', height: '100%', visibility: viewMode === '2d' ? 'visible' : 'hidden' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <PhenomenonHeatmap active={heatEnabled} />
            <Background color="#1e293b" gap={30} size={1} />
            <Controls className="flow-controls" showInteractive={false} />
            <MiniMap
              nodeColor={(n) => n.data?.color || '#475569'}
              maskColor="rgba(0,0,0,0.7)"
              className="flow-minimap"
            />
          </ReactFlow>
        </div>

        <Legend
          domains={domains}
          colors={DOMAIN_COLORS}
          currentFilter={filterDomain}
          onFilterChange={setFilterDomain}
        />

        {chatOpen && (
          <ChatPanel
            onNodeSelect={handleNodeSelectFromChat}
            onClose={() => setChatOpen(false)}
            fontSize={fontSize}
          />
        )}

        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            domainColor={DOMAIN_COLORS[selectedNode.domain] || '#6b7280'}
            onFollowThread={handleFollowThread}
            onPredictBranch={handlePredictBranch}
            onMaterialize={handleMaterialize}
          />
        )}

        {narrativeThread && (
          <div className="narrative-overlay" style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(600px, 90vw)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #fbbf2466',
            borderRadius: '12px',
            padding: '20px',
            color: 'white',
            zIndex: 100,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 20px #fbbf2422'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#fbbf24', fontWeight: 'bold' }}>
              <span>🧶</span> Narrative Thread Active
            </div>
            <p style={{ fontSize: '15px', lineHeight: '1.6', color: '#e2e8f0', margin: 0 }}>
              {narrativeThread.explanation}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              {narrativeThread.path?.map?.((id, index) => (
                <React.Fragment key={typeof id === 'string' ? id : index}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>[{String(id).slice(0, 8)}]</span>
                  {index < narrativeThread.path.length - 1 && <span style={{ color: '#475569' }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <GraphView />
    </ReactFlowProvider>
  );
}
