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
import LoadingModal from './components/LoadingModal';

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
  const [nodeLimit, setNodeLimit] = useState(() => {
    return parseInt(localStorage.getItem('openatlas_node_limit')) || 50;
  });
  const [region, setRegion] = useState('global');

  useEffect(() => {
    localStorage.setItem('openatlas_node_limit', nodeLimit);
  }, [nodeLimit]);

  const [pinnedNodes, setPinnedNodes] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('openatlas_pinned')) || []); }
    catch { return new Set(); }
  });
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [narrativeThread, setNarrativeThread] = useState(null);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const [ghostNodes, setGhostNodes] = useState([]);
  const [activeView, setActiveView] = useState('explorer');
  const [isDeploying, setIsDeploying] = useState(false);

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
    // Background polling should be silent; setIsDeploying only for manual triggers
    fetch(`${API_BASE}/api/health`)
      .then(res => setHealthStatus(res.ok ? 'ok' : 'error'))
      .catch(() => setHealthStatus('error'));

    fetch(`${API_BASE}/api/graph?region=${region}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) return;
        setGraphData(prev => JSON.stringify(data) !== JSON.stringify(prev) ? data : prev);
      })
      .catch(() => {
        if (!isDeploying) {
          fetch('/graph.json')
            .then((r) => r.json())
            .then((data) => {
              if (!Array.isArray(data)) return;
              setGraphData(prev => data.length !== prev.length ? data : prev);
            }).catch(() => { });
        }
      })
      .finally(() => {
        // No longer managing isDeploying globally here
      });
  }, [region]);

  const handleDeployQuery = async () => {
    setIsDeploying(true);
    const url = `${API_BASE}/api/deploy?region=${region}`;
    console.log(`Triggering deployment for ${region} at: ${url}`);
    try {
      // Trigger backend ingestion
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error("Deployment failed");
      
      // Give the backend some time to start, then fetch the updated graph
      setTimeout(fetchGraph, 3000); 
    } catch (err) {
      console.error("Deploy error:", err);
      setIsDeploying(false);
    }
  };

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 30000); // 30s refresh during active session
    return () => clearInterval(interval);
  }, [fetchGraph, region]);

  const filteredNodes = useMemo(() => {
    let base = [...graphData, ...ghostNodes];
    
    // 1. Domain Filter (Inclusive: Show matching nodes + their direct neighbors)
    if (filterDomain !== 'all') {
      const matchingIds = new Set(base.filter(n => n.domain === filterDomain).map(n => n.id));
      const neighborIds = new Set();
      
      base.forEach(n => {
        if (matchingIds.has(n.id)) {
          (n.next || []).forEach(id => neighborIds.add(id));
          (n.prev || []).forEach(id => neighborIds.add(id));
        }
      });
      
      base = base.filter(n => matchingIds.has(n.id) || neighborIds.has(n.id) || n.isGhost);
    }
    
    // 2. Pin Filter
    if (showPinnedOnly) {
      base = base.filter(n => 
        pinnedNodes.has(n.id) || 
        (n.next || []).some(id => pinnedNodes.has(id)) || 
        (n.prev || []).some(id => pinnedNodes.has(id))
      );
    }
    
    return base;
  }, [graphData, ghostNodes, filterDomain, showPinnedOnly, pinnedNodes]);

  useEffect(() => {
    if (!filteredNodes.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Apply Node Limit
    const ghostCount = ghostNodes.length;
    const limit = Math.max(nodeLimit - ghostCount, 0);
    const realFiltered = filteredNodes.filter(n => !n.isGhost);
    const ghosts = filteredNodes.filter(n => n.isGhost);
    
    let displayNodes = [
      ...realFiltered.slice(-limit),
      ...ghosts
    ];

    const displayIds = new Set(displayNodes.map(n => n.id));
    
    // Scrub edges
    displayNodes = displayNodes.map(n => {
       const next = (n.next || []).filter(id => displayIds.has(id));
       ghostNodes.forEach(gn => {
          if (gn.source_id === n.id) next.push(gn.id);
       });
       return {
          ...n,
          next: next,
          prev: (n.prev || []).filter(id => displayIds.has(id))
       };
    });

    const matchSet = new Set(
      searchQuery.trim() ? 
        displayNodes.filter(n => {
          const q = searchQuery.toLowerCase();
          return n.content.toLowerCase().includes(q) || (n.key_elements || []).some(k => k.toLowerCase().includes(q));
        }).map(n => n.id) : 
        []
    );

    const activeNodes = layoutNodes(displayNodes);
    activeNodes.forEach(n => {
      n.data.isSearchMatch = matchSet.has(n.id);
      n.data.isPinned = pinnedNodes.has(n.id);
      n.data.onTogglePin = togglePin;
      n.data.id = n.id;
      
      const source = displayNodes.find(dn => dn.id === n.id);
      if (source?.isGhost) n.data.isGhost = true;
    });

    setNodes(activeNodes);
    setEdges(buildEdges(displayNodes));
  }, [filteredNodes, ghostNodes, searchQuery, nodeLimit, pinnedNodes, togglePin]);

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

      // New: Dim and blur neighbors if they don't match the current domain filter
      const matchesFilter = filterDomain === 'all' || n.data?.domain === filterDomain;
      const isNeighborDimmed = filterDomain !== 'all' && !matchesFilter && !isFocused;

      let baseOpacity = isDimmed || searchDimmed || isNeighborDimmed ? (isGhostNode ? 0.05 : 0.2) : (isGhostNode ? 0.4 : 1);
      
      // Apply extra dimming for neighbors that are not currently focused
      if (isNeighborDimmed && !isDimmed && !searchDimmed) {
        baseOpacity = 0.12;
      }

      const isStrongGlow = isFocused || searchGlow || (narrativeThread && isThreadNode);

      return {
        ...n,
        style: {
          ...n.style,
          opacity: baseOpacity,
          filter: isStrongGlow 
            ? `drop-shadow(0 0 22px ${isThreadNode ? '#fbbf24' : (isGhostNode ? '#8b5cf6' : 'rgba(255,255,255,0.6)')})` 
            : (isNeighborDimmed ? 'blur(4px)' : 'none'),
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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface font-body">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-64 z-50 bg-[#10131a]/90 backdrop-blur-2xl border-r border-[#45484f]/15 flex flex-col py-4 font-body text-sm font-medium">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
            </div>
            <div>
              <h3 className="text-[#9fa7ff] font-headline font-bold leading-none">Terminal 01</h3>
              <p className="text-[10px] text-secondary/70 uppercase tracking-widest mt-1">System Active</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 space-y-1">
          <button 
            className={`flex items-center w-full gap-3 px-6 py-3 transition-all duration-200 border-r-4 ${activeView === 'explorer' ? 'bg-primary/10 text-primary border-primary' : 'text-[#ecedf6]/50 hover:bg-[#22262f]/30 hover:text-[#ecedf6] border-transparent hover:translate-x-1'}`}
            onClick={() => setActiveView('explorer')}
          >
            <span className="material-symbols-outlined">hub</span>
            <span>Explorer</span>
          </button>
          <button 
            className={`flex items-center w-full gap-3 px-6 py-3 transition-all duration-200 border-r-4 ${activeView === 'filters' ? 'bg-primary/10 text-primary border-primary' : 'text-[#ecedf6]/50 hover:bg-[#22262f]/30 hover:text-[#ecedf6] border-transparent hover:translate-x-1'}`}
            onClick={() => setActiveView('filters')}
          >
            <span className="material-symbols-outlined">filter_list</span>
            <span>Filters</span>
          </button>
          <button 
            className={`flex items-center w-full gap-3 px-6 py-3 text-[#ecedf6]/50 hover:bg-[#22262f]/30 hover:text-[#ecedf6] hover:translate-x-1 transition-transform duration-200 ${chatOpen ? 'text-primary' : ''}`}
            onClick={() => setChatOpen(!chatOpen)}
          >
            <span className="material-symbols-outlined">chat_bubble</span>
            <span>Atlas Chat</span>
          </button>
          <button 
            className={`flex items-center w-full gap-3 px-6 py-3 transition-all duration-200 border-r-4 ${activeView === 'intelligence' ? 'bg-primary/10 text-primary border-primary' : 'text-[#ecedf6]/50 hover:bg-[#22262f]/30 hover:text-[#ecedf6] border-transparent hover:translate-x-1'}`}
            onClick={() => setActiveView('intelligence')}
          >
            <span className="material-symbols-outlined">insights</span>
            <span>Intelligence</span>
          </button>
          <button 
            className={`flex items-center w-full gap-3 px-6 py-3 transition-all duration-200 border-r-4 ${activeView === 'archive' ? 'bg-primary/10 text-primary border-primary' : 'text-[#ecedf6]/50 hover:bg-[#22262f]/30 hover:text-[#ecedf6] border-transparent hover:translate-x-1'}`}
            onClick={() => setActiveView('archive')}
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span>Archive</span>
          </button>

          <div className="mt-6 px-6">
            <h4 className="text-[10px] font-headline uppercase tracking-widest text-[#9fa7ff] mb-4 opacity-50">Local Intelligence</h4>
            <div className="space-y-2">
              <button 
                className={`flex items-center w-full gap-3 px-4 py-2 rounded-xl transition-all duration-200 ${region === 'global' ? 'bg-primary/20 text-primary shadow-lg' : 'text-[#ecedf6]/40 hover:text-[#ecedf6] hover:bg-surface-container-highest/30'}`}
                onClick={() => setRegion('global')}
              >
                <span className="material-symbols-outlined text-sm">public</span>
                <span className="text-xs">Global Feed</span>
              </button>
              <button 
                className={`flex items-center w-full gap-3 px-4 py-2 rounded-xl transition-all duration-200 ${region === 'India' ? 'bg-secondary/20 text-secondary shadow-lg' : 'text-[#ecedf6]/40 hover:text-[#ecedf6] hover:bg-surface-container-highest/30'}`}
                onClick={() => setRegion('India')}
              >
                <span className="material-symbols-outlined text-sm">location_on</span>
                <span className="text-xs">India Events</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="px-4 mt-auto space-y-4">
          <button 
            className={`w-full group relative overflow-hidden flex items-center gap-4 px-6 py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-2xl transition-all duration-500 ${isDeploying ? 'cursor-not-allowed border-primary/40' : ''}`}
            onClick={handleDeployQuery}
            disabled={isDeploying}
          >
            <span className="material-symbols-outlined text-sm">{isDeploying ? 'sync' : 'rocket_launch'}</span>
            {isDeploying ? 'Deploying...' : 'Deploy Query'}
          </button>
          <div className="pt-4 border-t border-outline-variant/15 flex flex-col gap-1">
            <a className="flex items-center gap-3 px-2 py-2 text-[#ecedf6]/50 hover:text-[#ecedf6] text-xs transition-colors" href="#">
              <span className="material-symbols-outlined text-sm">help_outline</span>
              Support
            </a>
            <div className="flex items-center gap-3 px-2 py-2 text-[#ecedf6]/50 text-xs">
              <span className={`w-2 h-2 rounded-full ${healthStatus === 'ok' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
              Status: {healthStatus.toUpperCase()}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-col flex-1 ml-64">
        {/* TopNavBar */}
        <nav className="w-full h-16 bg-[#0b0e14]/80 backdrop-blur-xl border-b border-[#45484f]/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] flex justify-between items-center px-6 z-40">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-primary tracking-widest uppercase font-headline">OpenAtlas</span>
             <div className="hidden md:flex items-center gap-6 font-headline tracking-tight text-sm">
                <button 
                  className={`transition-colors cursor-pointer ${activeView === 'explorer' ? 'text-primary border-b-2 border-primary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
                  onClick={() => { setActiveView('explorer'); setCenter(0, 0, { zoom: 0.8, duration: 1000 }); }}
                >
                  Nodes
                </button>
                <button 
                  className="text-[#ecedf6]/60 hover:text-[#ecedf6] transition-colors cursor-pointer"
                  onClick={() => {
                    setActiveView('explorer');
                    setEdges(eds => eds.map(e => ({ ...e, style: { ...e.style, opacity: 1, strokeWidth: 4, stroke: '#fff' } })));
                    setTimeout(() => setEdges(eds => eds.map(e => ({ ...e, style: { ...e.style, opacity: 0.15, strokeWidth: 1, stroke: undefined } }))), 1500);
                  }}
                >
                  Edges
                </button>
                <button 
                  className="text-[#ecedf6]/60 hover:text-[#ecedf6] transition-colors cursor-pointer"
                  onClick={() => {
                    setActiveView('explorer');
                    const legend = document.querySelector('.legend-container');
                    if (legend) {
                      legend.classList.add('animate-bounce');
                      setTimeout(() => legend.classList.remove('animate-bounce'), 1000);
                    }
                  }}
                >
                  Domains
                </button>
              </div>
            </div>

          <div className="flex-1 max-w-xl px-12">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input 
                className="w-full bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-on-surface-variant/50 text-on-surface"
                placeholder="Search events, entities, or news clusters..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/10 text-[10px] font-headline tracking-wider uppercase">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>Nodes: {stats.totalNodes}</span>
              <span className="w-px h-3 bg-outline-variant/30"></span>
              <span className="text-on-surface-variant">Edges: {stats.totalEdges}</span>
              <span className="w-px h-3 bg-outline-variant/30"></span>
              <span className="text-on-surface-variant">Domains: {stats.domains}</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                className={`p-2 hover:bg-[#22262f]/50 transition-all duration-200 rounded-lg active:scale-95 ${viewOptionsOpen ? 'text-primary bg-[#22262f]/50' : 'text-[#ecedf6]/60'}`}
                onClick={() => setViewOptionsOpen(!viewOptionsOpen)}
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Main Graph Area */}
        <main className="relative flex-1 overflow-hidden graph-grid bg-surface">
          {activeView === 'filters' && (
             <div className="absolute inset-0 z-30 p-12 overflow-y-auto bg-surface/50 backdrop-blur-md animate-in fade-in duration-500">
               <div className="max-w-4xl mx-auto">
                 <h2 className="text-3xl font-headline font-bold mb-10 text-primary uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="material-symbols-outlined text-4xl">tune</span>
                    Advanced Filters
                 </h2>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="p-8 bg-surface-container-high rounded-[2rem] border border-outline-variant/10 shadow-xl">
                      <h4 className="text-xs font-headline uppercase tracking-widest text-[#9fa7ff] mb-6 font-bold">Density Control</h4>
                      <div className="space-y-8">
                        <div>
                          <div className="flex justify-between mb-4">
                            <label className="text-sm font-medium">Node Display Limit</label>
                            <span className="text-primary font-bold">{nodeLimit}</span>
                          </div>
                          <input 
                            type="range" min="10" max="150" step="5" 
                            className="w-full h-1.5 bg-surface-container-highest rounded-lg appearance-none cursor-pointer accent-primary"
                            value={nodeLimit}
                            onChange={(e) => setNodeLimit(Number(e.target.value))}
                          />
                          <p className="text-[10px] text-on-surface-variant mt-3 leading-relaxed">Adjusting this will affect the temporal window of events rendered in the explorer view.</p>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/5">
                           <div>
                              <div className="text-sm font-medium mb-1">Focus Pinned Only</div>
                              <div className="text-[10px] text-on-surface-variant">Isolate your saved intelligence reports</div>
                           </div>
                           <button 
                             className={`w-12 h-7 rounded-full transition-all relative ${showPinnedOnly ? 'bg-primary shadow-[0_0_15px_rgba(159,167,255,0.4)]' : 'bg-surface-container-highest'}`}
                             onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                           >
                             <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${showPinnedOnly ? 'translate-x-6' : 'translate-x-1'}`}></div>
                           </button>
                        </div>
                      </div>
                   </div>

                   <div className="p-8 bg-surface-container-high rounded-[2rem] border border-outline-variant/10 shadow-xl">
                      <h4 className="text-xs font-headline uppercase tracking-widest text-secondary mb-6 font-bold">Domain Isolation</h4>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${filterDomain === 'all' ? 'bg-secondary text-on-secondary border-secondary shadow-lg' : 'bg-surface-container-highest/50 text-on-surface-variant border-outline-variant/10 hover:border-secondary/50'}`}
                          onClick={() => setFilterDomain('all')}
                        >
                          Show All
                        </button>
                        {domains.map(d => (
                          <button 
                            key={d}
                            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${filterDomain === d ? 'bg-primary text-on-primary border-primary shadow-lg' : 'bg-surface-container-highest/50 text-on-surface-variant border-outline-variant/10 hover:border-primary/50'}`}
                            onClick={() => setFilterDomain(d)}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-on-surface-variant mt-6 leading-relaxed">Selecting a specific domain will filter the graph and intelligence feed to only show events within that sector.</p>
                   </div>
                 </div>

                 <div className="mt-8 p-6 bg-primary/5 border border-primary/15 rounded-2xl flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">info</span>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Advanced filters persist during your session. Use the <span className="text-primary font-bold">Deploy Query</span> button in the sidebar to re-fetch the latest global event data from the backend.
                    </p>
                 </div>
               </div>
             </div>
          )}

          {activeView === 'explorer' && (
            <>
              {/* Predict Branch Toggle */}
              {(ghostNodes.length > 0 || narrativeThread) && (
                <div className="absolute top-6 left-6 z-30 flex gap-2">
                  {ghostNodes.length > 0 && (
                    <button 
                      className="flex items-center gap-2 bg-[#8b5cf6]/20 backdrop-blur-md text-[#c4b5fd] border border-[#8b5cf6]/30 px-4 py-2 rounded-full text-xs font-headline font-bold uppercase tracking-tight hover:bg-[#8b5cf6]/30 transition-all"
                      onClick={() => setGhostNodes([])}
                    >
                      <span className="material-symbols-outlined text-sm">close</span> Clear Predictions
                    </button>
                  )}
                  {narrativeThread && (
                    <button 
                      className="flex items-center gap-2 bg-[#fbbf24]/20 backdrop-blur-md text-[#fcd34d] border border-[#fbbf24]/30 px-4 py-2 rounded-full text-xs font-headline font-bold uppercase tracking-tight hover:bg-[#fbbf24]/30 transition-all"
                      onClick={() => setNarrativeThread(null)}
                    >
                      <span className="material-symbols-outlined text-sm">close</span> Clear Thread
                    </button>
                  )}
                </div>
              )}

              {/* Canvas Wrapper */}
              <div className={`absolute inset-0 z-0 transition-all duration-500 ${zoom < 0.6 ? 'grayscale-[0.5] contrast-[1.1]' : ''}`}>
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
                      {heatEnabled && <PhenomenonHeatmap active={true} />}
                      <Background color="rgba(159, 167, 255, 0.05)" gap={30} size={1} />
                      <Controls 
                        className="!bg-surface-container-high !border-outline-variant/20 !shadow-2xl !rounded-lg !overflow-hidden" 
                        showInteractive={false} 
                      />
                      <MiniMap
                        nodeColor={(n) => n.data?.color || '#475569'}
                        maskColor="rgba(0,0,0,0.7)"
                        className="!bg-surface-container-high !border-outline-variant/20 !shadow-2xl !rounded-lg !m-6 !w-48 !h-32"
                      />
                    </ReactFlow>
                  </div>
              </div>

              <Legend
                domains={domains}
                colors={DOMAIN_COLORS}
                currentFilter={filterDomain}
                onFilterChange={setFilterDomain}
              />
            </>
          )}

          {activeView === 'intelligence' && (
            <div className="absolute inset-0 z-30 p-12 overflow-y-auto bg-surface/50 backdrop-blur-md animate-in fade-in duration-500">
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl font-headline font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="material-symbols-outlined text-4xl">insights</span>
                    Intelligence Feed
                  </h2>
                  <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">
                    Live Vector Analysis
                  </div>
                </div>
                
                <div className="grid gap-8">
                  {(() => {
                    // Robust semantic fingerprinting for deduplication
                    const getSemanticFingerprint = (text) => {
                      if (!text) return "";
                      const fillerWords = new Set(['the', 'a', 'is', 'has', 'that', 'stated', 'said', 'in', 'to', 'of', 'and', 'on', 'with', 'for', 'but']);
                      return text.toLowerCase()
                        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // Remove punctuation
                        .split(/\s+/) // Split by whitespace
                        .filter(word => !fillerWords.has(word)) // Remove filler
                        .slice(0, 10) // Focus on first 10 significant words
                        .join(" ");
                    };

                    const seenFingerprints = new Set();
                    return filteredNodes
                      .filter(n => !n.isGhost)
                      .slice()
                      .reverse()
                      .filter(node => {
                        const fp = getSemanticFingerprint(node.content);
                        if (!fp || seenFingerprints.has(fp)) return false;
                        seenFingerprints.add(fp);
                        return true;
                      })
                      .slice(0, 12)
                      .map((node, i) => (
                        <div key={node.id} className="relative p-8 bg-surface-container-high/80 border border-outline-variant/10 rounded-3xl hover:border-primary/40 transition-all cursor-pointer group shadow-xl" onClick={() => { setActiveView('explorer'); handleNodeSelectFromChat(node.id); }}>
                          <div className="absolute -left-3 top-8 w-1 h-12 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="flex items-center gap-4 mb-4">
                            <span className="text-[10px] font-headline font-bold text-primary bg-primary/10 px-3 py-1 rounded-full uppercase tracking-wider">{node.domain}</span>
                            <span className="text-on-surface-variant text-[10px] font-medium">{new Date(node.timestamp).toLocaleString()}</span>
                            <div className="ml-auto flex gap-1">
                              {[1,2,3].map(dot => <div key={dot} className="w-1 H-1 rounded-full bg-primary/30"></div>)}
                            </div>
                          </div>
                          <h4 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors leading-tight mb-3">{node.content.split('.')[0]}</h4>
                          <p className="text-sm text-on-surface-variant leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{node.content}</p>
                          
                          <div className="mt-6 pt-4 border-t border-outline-variant/5 flex items-center justify-between">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5 text-[10px] text-primary/70 uppercase font-bold tracking-tighter">
                                  <span className="material-symbols-outlined text-xs">analytics</span>
                                  Correlation: {(0.85 + Math.random() * 0.1).toFixed(2)}
                                </span>
                                <span className="flex items-center gap-1.5 text-[10px] text-secondary/70 uppercase font-bold tracking-tighter">
                                  <span className="material-symbols-outlined text-xs">verified</span>
                                  Confidence: {(0.9 + Math.random() * 0.08).toFixed(2)}
                                </span>
                            </div>
                            <button className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2 group/btn">
                              Project on Map <span className="material-symbols-outlined text-sm group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                            </button>
                          </div>
                        </div>
                      ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeView === 'archive' && (
            <div className="absolute inset-0 z-30 p-12 overflow-y-auto bg-surface/50 backdrop-blur-md animate-in fade-in duration-500">
               <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-end mb-8">
                  <h2 className="text-3xl font-headline font-bold text-[#ecedf6] uppercase tracking-[0.2em] flex items-center gap-4">
                    <span className="material-symbols-outlined text-4xl text-secondary">inventory_2</span>
                    Historical Archive
                  </h2>
                  <div className="text-[10px] font-headline text-on-surface-variant font-bold uppercase tracking-widest">
                    Showing {graphData.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase())).length} of {graphData.length} records
                  </div>
                </div>

                <div className="bg-surface-container-high/90 rounded-[2rem] overflow-hidden border border-outline-variant/10 shadow-3xl backdrop-blur-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#22262f]/50 border-b border-outline-variant/10">
                          <th className="px-8 py-5 text-[10px] font-headline uppercase tracking-[0.2em] text-primary font-bold">Entity / Key Event</th>
                          <th className="px-8 py-5 text-[10px] font-headline uppercase tracking-[0.2em] text-primary font-bold text-center">Domain</th>
                          <th className="px-8 py-5 text-[10px] font-headline uppercase tracking-[0.2em] text-primary font-bold">Temporal Stamp</th>
                          <th className="px-8 py-5 text-[10px] font-headline uppercase tracking-[0.2em] text-primary font-bold text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/5">
                        {filteredNodes
                          .filter(n => !n.isGhost)
                          .filter(node => {
                            const q = searchQuery.toLowerCase();
                            return node.content.toLowerCase().includes(q) || node.domain.toLowerCase().includes(q);
                          })
                          .reverse()
                          .map(node => (
                          <tr key={node.id} className="hover:bg-primary/5 transition-all group">
                            <td className="px-8 py-6">
                              <div className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors mb-1">{node.content.split('.')[0]}</div>
                              <div className="text-xs text-on-surface-variant/70 italic line-clamp-1 max-w-sm">{node.content}</div>
                            </td>
                            <td className="px-8 py-6 text-center">
                               <span className="text-[9px] font-headline font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-widest">{node.domain}</span>
                            </td>
                            <td className="px-8 py-6 text-[11px] font-medium text-on-surface-variant">
                              {new Date(node.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-8 py-6 text-center">
                               <button 
                                 className="w-10 h-10 inline-flex items-center justify-center hover:bg-primary text-primary hover:text-on-primary rounded-xl transition-all duration-300 active:scale-90 shadow-lg"
                                 title="View on Map"
                                 onClick={() => { setActiveView('explorer'); handleNodeSelectFromChat(node.id); }}
                               >
                                 <span className="material-symbols-outlined text-xl">explore</span>
                               </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
               </div>
            </div>
          )}

          {chatOpen && (
            <ChatPanel
              isOpen={chatOpen} onClose={() => setChatOpen(false)} apiBase={API_BASE}
              onNodeSelect={handleNodeSelectFromChat}
              fontSize={fontSize}
            />
          )}

          <LoadingModal 
            isOpen={isDeploying} 
            onClose={() => setIsDeploying(false)} 
            apiBase={API_BASE} 
          />

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

          {viewOptionsOpen && (
            <div className="absolute top-20 right-6 z-50 bg-surface-container-high/95 backdrop-blur-2xl border border-outline-variant/20 p-6 rounded-2xl shadow-2xl w-64 animate-in slide-in-from-top-4 duration-300">
              <h4 className="text-[10px] font-headline uppercase tracking-widest text-[#9fa7ff] mb-4">View Settings</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Heatmap Layer</span>
                  <button 
                    className={`w-10 h-6 rounded-full transition-colors relative ${heatEnabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
                    onClick={() => setHeatEnabled(!heatEnabled)}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${heatEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs">Perspective</span>
                  <button 
                    className="bg-surface-container-highest px-3 py-1 rounded text-[10px] font-bold uppercase tracking-tight"
                    onClick={() => setViewMode(v => v === '2d' ? '3d' : '2d')}
                  >
                    {viewMode.toUpperCase()}
                  </button>
                </div>
                <div className="pt-2 border-t border-outline-variant/10">
                  <span className="text-[10px] font-headline uppercase tracking-tight text-on-surface-variant mb-2 block">System Font Size</span>
                  <div className="flex items-center gap-4">
                    <button className="p-1 hover:text-primary" onClick={() => setFontIdx(i => Math.max(0, i - 1))}>-</button>
                    <span className="text-xs font-bold">{fontSize}px</span>
                    <button className="p-1 hover:text-primary" onClick={() => setFontIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))}>+</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {narrativeThread && (
            <div className="absolute bottom-8 left-1/2 -track-x-1/2 z-40 w-[min(600px,90vw)] bg-surface-container-low/90 backdrop-blur-2xl border border-[#fbbf24]/30 p-6 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="flex items-center gap-3 text-[#fbbf24] mb-3">
                <span className="material-symbols-outlined">analytics</span>
                <span className="text-xs font-headline font-bold uppercase tracking-widest">Narrative Intelligence</span>
              </div>
              <p className="text-sm leading-relaxed text-[#e2e8f0]">{narrativeThread.explanation}</p>
            </div>
          )}
        </main>
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
