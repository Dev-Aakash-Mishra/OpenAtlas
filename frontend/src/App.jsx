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
  agriculture: '#166534',
  development: '#1e40af',
  education: '#eab308',
  entertainment: '#f472b6',
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stateFilter, setStateFilter] = useState('all');
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const toastTimerRef = React.useRef(null);

  const showToast = (message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

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
  const [isProcessingThread, setIsProcessingThread] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [ghostNodes, setGhostNodes] = useState([]);
  const [activeView, setActiveView] = useState('explorer');
  const [isDeploying, setIsDeploying] = useState(false);
  const [timeWindow, setTimeWindow] = useState('all'); // Default to all to show history
  // Default to 'list' for first-time users, persist preference
  const [viewLayout, setViewLayout] = useState(() => {
    return localStorage.getItem('openatlas_view_layout') || 'list';
  });
  const [showRegionTooltip, setShowRegionTooltip] = useState(() => {
    return !localStorage.getItem('openatlas_region_tooltip_seen');
  });

  const dismissRegionTooltip = () => {
    localStorage.setItem('openatlas_region_tooltip_seen', '1');
    setShowRegionTooltip(false);
  };

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

    let startDate = null;
    if (timeWindow !== 'all') {
      const d = new Date();
      if (timeWindow === '24h') d.setHours(d.getHours() - 24);
      else if (timeWindow === '3d') d.setDate(d.getDate() - 3);
      else if (timeWindow === '7d') d.setDate(d.getDate() - 7);
      startDate = d.toISOString();
    }

    const url = `${API_BASE}/api/graph?region=${region}&limit=${nodeLimit}${startDate ? `&start_date=${startDate}` : ''}`;
    fetch(url)
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
  }, [region, nodeLimit, timeWindow]);

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

  // Persist view layout preference
  const handleSetViewLayout = (layout) => {
    setViewLayout(layout);
    localStorage.setItem('openatlas_view_layout', layout);
  };

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 30000); // 30s refresh during active session
    return () => clearInterval(interval);
  }, [fetchGraph, region]);

  const filteredNodes = useMemo(() => {
    let base = [...graphData, ...ghostNodes];
    
    // 0. State Filter (India mode only)
    if (stateFilter !== 'all') {
      base = base.filter(n => n.state === stateFilter || n.isGhost);
    }
    
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
  }, [graphData, ghostNodes, filterDomain, showPinnedOnly, pinnedNodes, stateFilter]);

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
      // Pass Indian metadata fields through to EventNode
      if (source) {
        n.data.trust_score = source.trust_score;
        n.data.bias_warning = source.bias_warning;
        n.data.publisher = source.publisher;
        n.data.state = source.state;
        n.data.district = source.district;
        n.data.region = source.region;
      }
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

      // Domain filter: matching nodes get full opacity + glow, non-matching are dimmed
      const matchesFilter = filterDomain === 'all' || n.data?.domain === filterDomain;
      const isDomainDimmed = filterDomain !== 'all' && !matchesFilter;
      const isDomainHighlighted = filterDomain !== 'all' && matchesFilter;

      // Priority: thread > focus > domain filter > search
      let baseOpacity;
      if (narrativeThread) {
        baseOpacity = isDimmed ? 0.05 : 1;
      } else if (activeFocusId) {
        baseOpacity = isDimmed ? 0.08 : (isDomainDimmed ? 0.1 : 1);
      } else if (filterDomain !== 'all') {
        baseOpacity = isDomainDimmed ? 0.08 : 1;
      } else {
        baseOpacity = searchDimmed ? 0.15 : (isGhostNode ? 0.7 : 1);
      }

      const isStrongGlow = isFocused || searchGlow || (narrativeThread && isThreadNode) || isDomainHighlighted;

      const filterStr = (() => {
        if (isDomainDimmed) return 'blur(2px)';
        if (narrativeThread && isDimmed) return 'blur(3px)';
        if (isDomainHighlighted) return `drop-shadow(0 0 16px ${n.data?.color || 'rgba(255,255,255,0.4)'})`;
        if (isStrongGlow) return `drop-shadow(0 0 22px ${isThreadNode ? '#fbbf24' : (isGhostNode ? '#8b5cf6' : 'rgba(255,255,255,0.6)')})`;
        if (isGhostNode) return 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.4))';
        return 'none';
      })();

      return {
        ...n,
        style: {
          ...n.style,
          opacity: baseOpacity,
          filter: filterStr,
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
      
      // OPTIMIZATION: Look up domains from graphData/ghostNodes to avoid 'nodes' dependency
      const allSourceData = [...graphData, ...ghostNodes];
      const edgeMatchesDomain = filterDomain === 'all' || (() => {
        const srcNode = allSourceData.find(n => n.id === e.source);
        const tgtNode = allSourceData.find(n => n.id === e.target);
        return srcNode?.domain === filterDomain || tgtNode?.domain === filterDomain;
      })();

      // Hover Focus Mode: default edges are very dim to un-clutter the view
      let op;
      if (narrativeThread) {
        op = isThreadEdge ? 1 : 0.01;
      } else if (activeFocusId) {
        op = isEdgeFocused ? 0.95 : 0.01;
      } else if (filterDomain !== 'all') {
        op = edgeMatchesDomain ? 0.7 : 0.03;
      } else {
        op = isGhostEdge ? 0.1 : 0.15;
      }
      const sw = (narrativeThread && isThreadEdge) ? 4 : (activeFocusId && isEdgeFocused ? 3 : (filterDomain !== 'all' && edgeMatchesDomain ? 2 : 1));
      
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
  }, [focusedNodeId, selectedNode, graphData, ghostNodes, searchQuery, setNodes, setEdges, narrativeThread, filterDomain]);

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
    setIsProcessingThread(true);
    fetch(`${API_BASE}/api/narrative_thread/${nodeId}`)
      .then(res => res.json())
      .then(data => {
        setNarrativeThread(data);
        // Clear selection to focus on the thread
        setSelectedNode(null);
      })
      .catch(err => console.error("Narrative thread fetch failed", err))
      .finally(() => setIsProcessingThread(false));
  }, []);

  const handlePredictBranch = useCallback((nodeId) => {
    setIsPredicting(true);
    fetch(`${API_BASE}/api/predict_branch/${nodeId}`)
      .then(res => res.json())
      .then(data => {
        setGhostNodes(prev => [...prev, ...data]);
      })
      .catch(err => console.error("Ghost prediction failed", err))
      .finally(() => setIsPredicting(false));
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
          showToast("Materialization failed: " + data.message, 'error');
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
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[55] bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {/* SideNavBar — hidden on mobile by default, toggleable */}
      <aside className={`fixed left-0 top-0 h-full w-64 z-[60] bg-[#10131a]/95 backdrop-blur-2xl border-r border-[#45484f]/15 flex flex-col py-4 font-body text-sm font-medium transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center border border-primary/30">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
            </div>
            <div>
              <h3 className="text-[#9fa7ff] font-headline font-bold leading-none">OpenAtlas</h3>
              <p className="text-[10px] text-secondary/70 uppercase tracking-widest mt-1">News Intelligence</p>
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
        </nav>

        <div className="px-4 mt-auto space-y-4">
          <button 
            className={`w-full group relative overflow-hidden flex items-center gap-4 px-6 py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-2xl transition-all duration-500 ${isDeploying ? 'cursor-not-allowed border-primary/40' : ''}`}
            onClick={handleDeployQuery}
            disabled={isDeploying}
          >
            <span className="material-symbols-outlined text-sm">{isDeploying ? 'sync' : 'refresh'}</span>
            {isDeploying ? 'Fetching...' : 'Fetch Latest News'}
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

      {/* Main Container — responsive margin */}
      <div className="flex flex-col flex-1 ml-0 md:ml-64">
        {/* TopNavBar */}
        <nav className="w-full h-14 md:h-16 bg-[#0b0e14]/80 backdrop-blur-xl border-b border-[#45484f]/15 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] flex justify-between items-center px-3 md:px-6 z-40">
          <div className="flex items-center gap-3 md:gap-8">
            {/* Hamburger for mobile */}
            <button className="md:hidden p-2 text-on-surface-variant hover:text-primary" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <span className="text-lg md:text-xl font-bold text-primary tracking-widest uppercase font-headline">OpenAtlas</span>
          <div className="hidden md:flex items-center gap-6 font-headline tracking-tight text-sm">
                <div className="relative">
                  <button 
                    className={`transition-colors cursor-pointer ${region === 'global' ? 'text-primary border-b-2 border-primary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
                    onClick={() => { setRegion('global'); setStateFilter('all'); dismissRegionTooltip(); }}
                  >
                    Global
                  </button>
                </div>
                <div className="relative">
                  <button 
                    className={`transition-colors cursor-pointer ${region === 'India' ? 'text-secondary border-b-2 border-secondary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
                    onClick={() => { setRegion('India'); dismissRegionTooltip(); }}
                  >
                    🇮🇳 India
                  </button>
                  {/* First-time onboarding tooltip */}
                  {showRegionTooltip && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-52 bg-secondary/95 backdrop-blur-xl text-on-secondary p-3 rounded-xl shadow-2xl border border-secondary/40 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="text-[10px] font-bold mb-1">🇮🇳 India Mode Available!</div>
                      <p className="text-[9px] leading-relaxed opacity-90">Switch to see cricket, regional, and state-level news in Hindi and English.</p>
                      <button className="mt-2 text-[9px] font-bold underline opacity-70 hover:opacity-100" onClick={dismissRegionTooltip}>Got it</button>
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-secondary rotate-45 rounded-sm"></div>
                    </div>
                  )}
                </div>
                <div className="w-px h-4 bg-outline-variant/30 ml-2"></div>
                <button 
                  className={`transition-colors cursor-pointer ${activeView === 'explorer' ? 'text-primary border-b-2 border-primary pb-1' : 'text-[#ecedf6]/60 hover:text-[#ecedf6]'}`}
                  onClick={() => { setActiveView('explorer'); setCenter(0, 0, { zoom: 0.8, duration: 1000 }); }}
                >
                  Nodes
                </button>
              </div>
            </div>

          <div className="flex-1 max-w-xl px-2 md:px-12">
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input 
                className="w-full bg-surface-container-highest border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/50 placeholder:text-on-surface-variant/50 text-on-surface"
                placeholder="Search topics, places, or news..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* State filter dropdown — only visible in India mode */}
          {region === 'India' && (
            <select
              className="bg-surface-container-highest border border-outline-variant/20 rounded-lg px-3 py-1.5 text-xs text-on-surface font-medium focus:ring-1 focus:ring-secondary/50 hidden sm:block"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="all">All States</option>
              <option value="Andhra Pradesh">Andhra Pradesh</option>
              <option value="Bihar">Bihar</option>
              <option value="Chhattisgarh">Chhattisgarh</option>
              <option value="Delhi">Delhi</option>
              <option value="Goa">Goa</option>
              <option value="Gujarat">Gujarat</option>
              <option value="Haryana">Haryana</option>
              <option value="Himachal Pradesh">Himachal Pradesh</option>
              <option value="Jammu and Kashmir">Jammu & Kashmir</option>
              <option value="Jharkhand">Jharkhand</option>
              <option value="Karnataka">Karnataka</option>
              <option value="Kerala">Kerala</option>
              <option value="Madhya Pradesh">Madhya Pradesh</option>
              <option value="Maharashtra">Maharashtra</option>
              <option value="Odisha">Odisha</option>
              <option value="Punjab">Punjab</option>
              <option value="Rajasthan">Rajasthan</option>
              <option value="Tamil Nadu">Tamil Nadu</option>
              <option value="Telangana">Telangana</option>
              <option value="Uttar Pradesh">Uttar Pradesh</option>
              <option value="Uttarakhand">Uttarakhand</option>
              <option value="West Bengal">West Bengal</option>
            </select>
          )}

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/10 text-[10px] font-headline tracking-wider uppercase">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>Nodes: {stats.totalNodes}</span>
              <span className="w-px h-3 bg-outline-variant/30"></span>
              <span className="text-on-surface-variant">Edges: {stats.totalEdges}</span>
              <span className="w-px h-3 bg-outline-variant/30"></span>
              <span className="text-on-surface-variant">Domains: {stats.domains}</span>
            </div>
            <div className="flex items-center gap-1">
              {/* View Layout toggle — always present */}
              <button 
                className={`p-2 hover:bg-[#22262f]/50 transition-all duration-200 rounded-lg active:scale-95 ${viewLayout === 'list' ? 'text-primary bg-[#22262f]/50' : 'text-[#ecedf6]/60'}`}
                onClick={() => handleSetViewLayout(viewLayout === 'graph' ? 'list' : 'graph')}
                title={viewLayout === 'graph' ? 'Switch to List View (InShorts Style)' : 'Switch to Graph View'}
              >
                <span className="material-symbols-outlined">{viewLayout === 'graph' ? 'view_agenda' : 'hub'}</span>
              </button>
              <button 
                className={`p-2 hover:bg-[#22262f]/50 transition-all duration-200 rounded-lg active:scale-95 ${viewOptionsOpen ? 'text-primary bg-[#22262f]/50' : 'text-[#ecedf6]/60'}`}
                onClick={() => setViewOptionsOpen(!viewOptionsOpen)}
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Main Graph Area / List Area */}
        <main className="relative flex-1 overflow-hidden graph-grid bg-surface">
          {viewLayout === 'list' ? (
            <ListView 
              nodes={nodes} 
              onNodeClick={(id) => { handleSetViewLayout('graph'); handleNodeSelectFromChat(id); }}
              domainColors={DOMAIN_COLORS}
            />
          ) : (
            <>
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
                            type="range" min="10" max="500" step="10" 
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

                    <div className="p-8 bg-surface-container-high rounded-[2rem] border border-outline-variant/10 shadow-xl col-span-full">
                       <h4 className="text-xs font-headline font-bold uppercase tracking-widest text-[#fbbf24] mb-6 font-bold">Temporal Focus</h4>
                       <div className="flex flex-wrap gap-3">
                         {[
                           { id: '24h', label: 'Last 24 Hours' },
                           { id: '3d', label: 'Last 3 Days' },
                           { id: '7d', label: 'Last Week' },
                           { id: 'all', label: 'Full Historical Atlas' }
                         ].map(tw => (
                           <button 
                             key={tw.id}
                             className={`px-6 py-3 rounded-2xl text-[10px] font-headline font-bold uppercase tracking-widest transition-all border ${timeWindow === tw.id ? 'bg-[#fbbf24] text-[#13151a] border-[#fbbf24] shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-105' : 'bg-surface-container-highest/50 text-on-surface-variant border-outline-variant/10 hover:border-[#fbbf24]/50'}`}
                             onClick={() => setTimeWindow(tw.id)}
                           >
                             {tw.label}
                           </button>
                         ))}
                       </div>
                       <p className="text-[10px] text-on-surface-variant mt-6 leading-relaxed">Shifting the temporal focus allows the OpenAtlas engine to retrieve deeper context from the global event database.</p>
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

                  {/* Floating Timeline Overlay */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[45] bg-surface-container-high/90 backdrop-blur-3xl border border-outline-variant/20 px-8 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-8 min-w-[500px] animate-in slide-in-from-bottom-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-headline font-bold uppercase tracking-[0.2em] text-[#9fa7ff]">Time Travel</span>
                      <span className="text-[8px] text-on-surface-variant uppercase tracking-tighter">Current Temporal Viewport</span>
                    </div>
                    <div className="flex-1 flex gap-2">
                      {[
                        { id: '24h', label: '24H' },
                        { id: '3d', label: '3D' },
                        { id: '7d', label: '7D' },
                        { id: 'all', label: 'History' }
                      ].map(tw => (
                        <button 
                          key={tw.id}
                          onClick={() => setTimeWindow(tw.id)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all duration-300 ${timeWindow === tw.id ? 'bg-primary text-on-primary shadow-[0_0_15px_rgba(159,167,255,0.4)] scale-105' : 'hover:bg-primary/10 text-on-surface-variant'}`}
                        >
                          {tw.label}
                        </button>
                      ))}
                    </div>
                    <div className="h-8 w-px bg-outline-variant/20"></div>
                    <div className="flex flex-col items-end">
                      <div className="text-xs font-bold font-headline text-primary tabular-nums">{graphData.length} <span className="text-[10px] text-on-surface-variant/50 font-normal">/ 500</span></div>
                      <div className="text-[8px] text-on-surface-variant uppercase font-bold tracking-widest">Nodes Active</div>
                    </div>
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
                            <span className="text-on-surface-variant text-[10px] font-medium">{new Date(node.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
                            <div className="ml-auto flex gap-1">
                              {[1,2,3].map(dot => <div key={dot} className="w-1 H-1 rounded-full bg-primary/30"></div>)}
                            </div>
                          </div>
                          <h4 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors leading-tight mb-3">{node.content.split('.')[0]}</h4>
                          <p className="text-sm text-on-surface-variant leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">{node.content}</p>
                          
                          <div className="mt-6 pt-4 border-t border-outline-variant/5 flex items-center justify-between">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1.5 text-[10px] text-primary/70 uppercase font-bold tracking-tighter">
                                  <span className="material-symbols-outlined text-xs">verified</span>
                                  Trust: {node.trust_score ?? 'N/A'}%
                                </span>
                                {node.bias_warning && (
                                  <span className="flex items-center gap-1.5 text-[10px] text-orange-400 uppercase font-bold tracking-tighter">
                                    <span className="material-symbols-outlined text-xs">warning</span>
                                    Bias Flagged
                                  </span>
                                )}
                                {node.publisher && (
                                  <span className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/70 uppercase font-bold tracking-tighter">
                                    <span className="material-symbols-outlined text-xs">newsmode</span>
                                    {node.publisher}
                                  </span>
                                )}
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
                              {new Date(node.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST
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
              isProcessingThread={isProcessingThread}
              isPredicting={isPredicting}
              showToast={showToast}
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
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-[min(600px,90vw)] bg-surface-container-low/90 backdrop-blur-2xl border border-[#fbbf24]/30 p-6 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-8">
              <div className="flex items-center gap-3 text-[#fbbf24] mb-3">
                <span className="material-symbols-outlined">analytics</span>
                <span className="text-xs font-headline font-bold uppercase tracking-widest">Narrative Intelligence</span>
              </div>
              <p className="text-sm leading-relaxed text-[#e2e8f0]">{narrativeThread.explanation}</p>
            </div>
          )}

          {toast.show && (
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl border shadow-2xl animate-in slide-in-from-bottom-4 flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-surface-container-high/90 border-outline-variant/30 text-on-surface'
            }`}>
              <span className="material-symbols-outlined text-sm">{toast.type === 'success' ? 'check_circle' : 'info'}</span>
              <span className="text-xs font-bold font-headline uppercase tracking-widest">{toast.message}</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ListView({ nodes, onNodeClick, domainColors }) {
  const displayNodes = nodes.filter(n => !n.data.isGhost).slice().reverse();
  
  const handleShare = (e, node) => {
    e.stopPropagation();
    const headline = node.data.content?.split('.')[0] || 'News';
    const url = node.data.source_url || window.location.href;
    const text = `${headline}\n\nRead more: ${url}\n\n— via OpenAtlas`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="absolute inset-0 z-30 p-4 md:p-12 overflow-y-auto bg-[#0b0e14]/50 backdrop-blur-md animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 md:mb-10">
          <h2 className="text-xl md:text-3xl font-headline font-bold text-primary uppercase tracking-[0.15em] md:tracking-[0.2em] flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl md:text-4xl">view_agenda</span>
            News Feed
          </h2>
          <div className="px-3 py-1.5 bg-secondary/10 border border-secondary/20 rounded-full text-[11px] font-bold text-secondary uppercase tracking-widest">
            {displayNodes.length} Stories
          </div>
        </div>
        
        {displayNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">newspaper</span>
            <h3 className="text-lg font-headline font-bold text-on-surface-variant mb-2">No news available yet</h3>
            <p className="text-sm text-on-surface-variant/70 max-w-md">Click "Fetch Latest News" in the sidebar to pull the latest stories, or switch between Global and India tabs.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {displayNodes.map((node) => (
              <div 
                key={node.id} 
                className="relative p-4 md:p-6 bg-surface-container-high/60 border border-outline-variant/10 rounded-xl md:rounded-2xl hover:border-primary/40 transition-all cursor-pointer group shadow-lg"
                onClick={() => onNodeClick(node.id)}
              >
                <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3">
                  <span className="text-[11px] font-headline font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-white" style={{ backgroundColor: domainColors[node.data.domain] }}>
                    {node.data.domain}
                  </span>
                  <span className="text-on-surface-variant text-[11px] font-medium">
                    {new Date(node.data.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} IST
                  </span>
                  {node.data.state && (
                    <span className="flex items-center gap-1 text-[11px] text-secondary font-bold uppercase tracking-tighter">
                      <span className="material-symbols-outlined text-xs">location_on</span>
                      {node.data.district ? `${node.data.district}, ${node.data.state}` : node.data.state}
                    </span>
                  )}
                  {node.data.region === 'India' && !node.data.state && (
                    <span className="flex items-center gap-1 text-[11px] text-secondary font-bold uppercase tracking-tighter">
                      🇮🇳 India
                    </span>
                  )}
                  {/* Share to WhatsApp */}
                  <button 
                    className="ml-auto p-1.5 rounded-lg hover:bg-green-500/10 text-on-surface-variant/50 hover:text-green-500 transition-colors"
                    onClick={(e) => handleShare(e, node)}
                    title="Share via WhatsApp"
                  >
                    <span className="material-symbols-outlined text-base">share</span>
                  </button>
                </div>
                <h4 className="text-base md:text-lg font-headline font-bold text-on-surface group-hover:text-primary transition-colors leading-tight mb-2">
                  {node.data.content?.split('.')[0]}
                </h4>
                <p className="text-xs md:text-sm text-on-surface-variant leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity whitespace-pre-wrap">
                  {node.data.content}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(node.data.key_elements || []).slice(0, 5).map(key => (
                    <span key={key} className="text-[11px] px-1.5 py-0.5 bg-surface-container-highest rounded text-on-surface-variant border border-outline-variant/5">
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
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
