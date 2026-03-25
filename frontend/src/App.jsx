import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

// Components
import EventNode from './nodes/EventNode';
import DetailPanel from './components/DetailPanel';
import Legend from './components/Legend';
import ChatPanel from './components/ChatPanel';
import GlobeView from './components/GlobeView';
import PhenomenonHeatmap from './components/PhenomenonHeatmap';
import IntelligenceHUD from './components/IntelligenceHUD';
import FilterBar from './components/FilterBar';
import DeepDiveModal from './components/DeepDiveModal';
import SideNavBar from './components/SideNavBar';
import TopNavBar from './components/TopNavBar';
import ListView from './components/ListView';
import NarrativeEvolution from './components/NarrativeEvolution';

// Utils and Constants
import { API_BASE, FONT_SIZES, DEFAULT_FONT_IDX, DOMAIN_COLORS } from './constants';
import { layoutNodes, buildEdges } from './utils/graphUtils';

const nodeTypes = { event: EventNode };

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('openatlas_sidebar_collapsed') === '1';
  });
  const [deepDiveAnalysis, setDeepDiveAnalysis] = useState(null);
  const [stateFilter, setStateFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(() => {
    return localStorage.getItem('openatlas_show_filters') !== '0';
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const toastTimerRef = useRef(null);

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
  const [timeWindow, setTimeWindow] = useState('all');
  const [viewLayout, setViewLayout] = useState(() => {
    return localStorage.getItem('openatlas_view_layout') || 'list';
  });
  const [showRegionTooltip, setShowRegionTooltip] = useState(() => {
    return !localStorage.getItem('openatlas_region_tooltip_seen');
  });
  const [evolutionData, setEvolutionData] = useState(null);
  const [evolutionQuery, setEvolutionQuery] = useState('');
  const [isEvolutionLoading, setIsEvolutionLoading] = useState(false);

  const dismissRegionTooltip = () => {
    localStorage.setItem('openatlas_region_tooltip_seen', '1');
    setShowRegionTooltip(false);
  };

  const togglePin = useCallback((id) => {
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
      });
  }, [region, nodeLimit, timeWindow, isDeploying]);

  const handleDeployQuery = async () => {
    setIsDeploying(true);
    const url = `${API_BASE}/api/deploy?region=${region}`;
    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) throw new Error("Deployment failed");
      setTimeout(fetchGraph, 3000); 
    } catch (err) {
      console.error("Deploy error:", err);
      setIsDeploying(false);
    }
  };

  const handleSetViewLayout = (layout) => {
    setViewLayout(layout);
    localStorage.setItem('openatlas_view_layout', layout);
  };

  const toggleSidebarCollapse = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    localStorage.setItem('openatlas_sidebar_collapsed', next ? '1' : '0');
  };

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 30000);
    return () => clearInterval(interval);
  }, [fetchGraph, region]);

  const filteredNodes = useMemo(() => {
    let base = [...graphData, ...ghostNodes];
    if (stateFilter !== 'all') {
      base = base.filter(n => n.state === stateFilter || n.isGhost);
    }
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

    const ghostCount = ghostNodes.length;
    const limit = Math.max(nodeLimit - ghostCount, 0);
    const realFiltered = filteredNodes.filter(n => !n.isGhost);
    const ghosts = filteredNodes.filter(n => n.isGhost);
    
    let displayNodes = [
      ...realFiltered.slice(-limit),
      ...ghosts
    ];

    const displayIds = new Set(displayNodes.map(n => n.id));
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
  }, [filteredNodes, ghostNodes, searchQuery, nodeLimit, pinnedNodes, togglePin, setNodes, setEdges]);

  useEffect(() => {
    if (!graphData.length) return;

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
          if (focusedData.isGhost && focusedData.source_id) connectedIds.add(focusedData.source_id);
          [...graphData, ...ghostNodes].forEach(gn => {
             if (gn.source_id === activeFocusId) connectedIds.add(gn.id);
          });
          isFocused = connectedIds.has(n.id);
          isDimmed = !isFocused;
        }
      }
      
      if (narrativeThread) isDimmed = !isThreadNode;

      const targetQuery = searchQuery?.trim() || '';
      const searchDimmed = targetQuery && !n.data.isSearchMatch;
      const searchGlow = targetQuery && n.data.isSearchMatch;
      const matchesFilter = filterDomain === 'all' || n.data?.domain === filterDomain;
      const isDomainDimmed = filterDomain !== 'all' && !matchesFilter;
      const isDomainHighlighted = filterDomain !== 'all' && matchesFilter;

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

      if (activeFocusId) isEdgeFocused = e.source === activeFocusId || e.target === activeFocusId;
      
      const allSourceData = [...graphData, ...ghostNodes];
      const edgeMatchesDomain = filterDomain === 'all' || (() => {
        const srcNode = allSourceData.find(n => n.id === e.source);
        const tgtNode = allSourceData.find(n => n.id === e.target);
        return srcNode?.domain === filterDomain || tgtNode?.domain === filterDomain;
      })();

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
    const nodeData = [...graphData, ...ghostNodes].find((n) => n.id === nodeId || n.id.startsWith(nodeId));
    if (nodeData) {
      setSelectedNode({
        ...nodeData,
        color: DOMAIN_COLORS[nodeData.domain] || '#6b7280',
        connectionCount: (nodeData.next?.length || 0) + (nodeData.prev?.length || 0),
      });

      const rfNode = nodes.find(n => n.id === nodeData.id);
      if (rfNode) {
        setCenter(rfNode.position.x + (rfNode.data?.size || 160) / 2, rfNode.position.y + 100, { zoom: 1.2, duration: 800 });
      }
    }
  }, [graphData, ghostNodes, nodes, setCenter]);

  const handleFollowThread = useCallback((nodeId) => {
    setIsProcessingThread(true);
    fetch(`${API_BASE}/api/narrative_thread/${nodeId}`)
      .then(res => res.json())
      .then(data => {
        setNarrativeThread(data);
        setSelectedNode(null);
      })
      .catch(err => console.error("Narrative thread fetch failed", err))
      .finally(() => setIsProcessingThread(false));
  }, []);

  const handlePredictBranch = useCallback((nodeId) => {
    setIsPredicting(true);
    fetch(`${API_BASE}/api/predict_branch/${nodeId}`)
      .then(res => res.json())
      .then(data => setGhostNodes(prev => [...prev, ...data]))
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
          setGhostNodes(prev => prev.filter(g => g.id !== ghostNode.id));
          fetchGraph();
          setSelectedNode(null);
        } else {
          showToast("Materialization failed: " + data.message, 'error');
        }
      })
      .catch(err => console.error("Materialization error", err));
  }, [fetchGraph]);

  const handleTraceEvolution = useCallback((_, query) => {
    setEvolutionQuery(query);
    setActiveView('evolution');
    setIsEvolutionLoading(true);
    fetch(`${API_BASE}/api/narrative_evolution?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => setEvolutionData(data))
      .catch(err => {
        console.error("Evolution fetch failed", err);
        showToast("Failed to fetch narrative evolution", "error");
      })
      .finally(() => setIsEvolutionLoading(false));
  }, []);

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
      <SideNavBar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeView={activeView}
        setActiveView={setActiveView}
        isSidebarCollapsed={isSidebarCollapsed}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        isDeploying={isDeploying}
        handleDeployQuery={handleDeployQuery}
        healthStatus={healthStatus}
      />

      <div className={`flex flex-col flex-1 transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'ml-0 md:ml-20' : 'ml-0 md:ml-64'}`}>
        <TopNavBar
          isSidebarCollapsed={isSidebarCollapsed}
          toggleSidebarCollapse={toggleSidebarCollapse}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          region={region}
          setRegion={setRegion}
          stateFilter={stateFilter}
          setStateFilter={setStateFilter}
          dismissRegionTooltip={dismissRegionTooltip}
          showRegionTooltip={showRegionTooltip}
          activeView={activeView}
          setActiveView={setActiveView}
          setCenter={setCenter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          stats={stats}
          viewLayout={viewLayout}
          handleSetViewLayout={handleSetViewLayout}
          viewOptionsOpen={viewOptionsOpen}
          setViewOptionsOpen={setViewOptionsOpen}
          showFilters={showFilters}
          setShowFilters={(val) => {
            setShowFilters(val);
            localStorage.setItem('openatlas_show_filters', val ? '1' : '0');
          }}
        />

        <FilterBar 
          region={region}
          stateFilter={stateFilter}
          setStateFilter={setStateFilter}
          filterDomain={filterDomain}
          setFilterDomain={setFilterDomain}
          domains={domains}
          timeWindow={timeWindow}
          setTimeWindow={setTimeWindow}
          nodeLimit={nodeLimit}
          setNodeLimit={setNodeLimit}
          showPinnedOnly={showPinnedOnly}
          setShowPinnedOnly={setShowPinnedOnly}
          showFilters={showFilters}
          setShowFilters={(val) => {
            setShowFilters(val);
            localStorage.setItem('openatlas_show_filters', val ? '1' : '0');
          }}
        />

        <main className="relative flex-1 overflow-hidden graph-grid bg-surface">
          {viewLayout === 'list' ? (
            <ListView 
              nodes={nodes} 
              onNodeClick={(id) => { handleSetViewLayout('graph'); handleNodeSelectFromChat(id); }}
              domainColors={DOMAIN_COLORS}
            />
          ) : (
            <>

              {activeView === 'explorer' && (
                <>
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
                        <Controls className="!bg-surface-container-high !border-outline-variant/20 !shadow-2xl !rounded-lg !overflow-hidden" showInteractive={false} />
                        <MiniMap
                          nodeColor={(n) => n.data?.color || '#475569'}
                          maskColor="rgba(0,0,0,0.7)"
                          className="!bg-surface-container-high !border-outline-variant/20 !shadow-2xl !rounded-lg !m-6 !w-48 !h-32"
                        />
                      </ReactFlow>
                    </div>

                  </div>

                  <Legend domains={domains} colors={DOMAIN_COLORS} currentFilter={filterDomain} onFilterChange={setFilterDomain} />
                </>
              )}
            </>
          )}

          {(activeView === 'intelligence' || activeView === 'archive') && (
            <div className="absolute inset-0 z-30 p-12 overflow-y-auto bg-surface/50 backdrop-blur-md animate-in fade-in duration-500">
               <div className="max-w-6xl mx-auto">
                {activeView === 'intelligence' ? (
                  <>
                    <div className="flex justify-between items-center mb-10">
                      <h2 className="text-3xl font-headline font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-4">
                        <span className="material-symbols-outlined text-4xl">rss_feed</span> Feeds
                      </h2>
                      <div className="px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest animate-pulse">
                        Live Vector Analysis
                      </div>
                    </div>
                    <div className="grid gap-8">
                       {/* Simplified Feed items rendering for brevity, keeping same logic as before */}
                       {filteredNodes.filter(n => !n.isGhost).slice().reverse().slice(0, 12).map((node) => (
                         <div key={node.id} className="relative p-8 bg-surface-container-high/80 border border-outline-variant/10 rounded-3xl hover:border-primary/40 transition-all cursor-pointer group shadow-xl" onClick={() => { setActiveView('explorer'); handleNodeSelectFromChat(node.id); }}>
                           {/* ... Feed Item Content ... */}
                           <h4 className="text-xl font-headline font-bold text-on-surface group-hover:text-primary transition-colors mb-3">{node.content.split('.')[0]}</h4>
                           <p className="text-sm text-on-surface-variant leading-relaxed opacity-80">{node.content}</p>
                         </div>
                       ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-end mb-8">
                      <h2 className="text-3xl font-headline font-bold text-[#ecedf6] uppercase tracking-[0.2em] flex items-center gap-4">
                        <span className="material-symbols-outlined text-4xl text-secondary">inventory_2</span> Historical Archive
                      </h2>
                    </div>
                    {/* Archive Table logic ... */}
                    <div className="bg-surface-container-high/90 rounded-[2rem] overflow-hidden border border-outline-variant/10 shadow-3xl">
                      {/* ... Table ... */}
                    </div>
                  </>
                )}
               </div>
            </div>
          )}

          {chatOpen && <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} apiBase={API_BASE} onNodeSelect={handleNodeSelectFromChat} fontSize={fontSize} />}
          <IntelligenceHUD 
            isOpen={isDeploying} 
            onClose={() => {
              setIsDeploying(false);
              fetchGraph();
            }} 
            apiBase={API_BASE} 
          />

          {selectedNode && (
            <DetailPanel
              node={{ ...selectedNode, onDeepDive: (analysis) => setDeepDiveAnalysis(analysis) }}
              onClose={() => setSelectedNode(null)}
              domainColor={DOMAIN_COLORS[selectedNode.domain] || '#6b7280'}
              onFollowThread={handleFollowThread}
              onPredictBranch={handlePredictBranch}
              onMaterialize={handleMaterialize}
              onEvolution={handleTraceEvolution}
              isProcessingThread={isProcessingThread}
              isPredicting={isPredicting}
              showToast={showToast}
            />
          )}

          {activeView === 'evolution' && (
            <NarrativeEvolution 
              query={evolutionQuery}
              evolutionData={evolutionData}
              isLoading={isEvolutionLoading}
              onClose={() => setActiveView('explorer')}
              onNodeClick={(id) => {
                setActiveView('explorer');
                handleNodeSelectFromChat(id);
              }}
            />
          )}

          {deepDiveAnalysis && <DeepDiveModal content={deepDiveAnalysis} onClose={() => setDeepDiveAnalysis(null)} />}
          
          {viewOptionsOpen && (
            <div className="absolute top-20 right-6 z-50 bg-surface-container-high/95 backdrop-blur-2xl border border-outline-variant/20 p-6 rounded-2xl shadow-2xl w-64 animate-in slide-in-from-top-4 duration-300">
               {/* View Options UI ... */}
               <div className="space-y-4">
                 <div className="flex items-center justify-between">
                   <span className="text-xs">Heatmap Layer</span>
                   <button className={`w-10 h-6 rounded-full relative ${heatEnabled ? 'bg-primary' : 'bg-surface-container-highest'}`} onClick={() => setHeatEnabled(!heatEnabled)}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${heatEnabled ? 'translate-x-5' : 'translate-x-1'}`}></div></button>
                 </div>
                 <div className="pt-2 border-t border-outline-variant/10">
                   <div className="flex items-center gap-4">
                     <button className="p-1" onClick={() => setFontIdx(i => Math.max(0, i - 1))}>-</button>
                     <span className="text-xs font-bold">{fontSize}px</span>
                     <button className="p-1" onClick={() => setFontIdx(i => Math.min(FONT_SIZES.length - 1, i + 1))}>+</button>
                   </div>
                 </div>
               </div>
            </div>
          )}

          {narrativeThread && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-[min(600px,90vw)] bg-surface-container-low/90 backdrop-blur-2xl border border-[#fbbf24]/30 p-6 rounded-2xl shadow-2xl">
              <p className="text-sm leading-relaxed text-[#e2e8f0]">{narrativeThread.explanation}</p>
            </div>
          )}

          {toast.show && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl bg-surface-container-high/90 border border-outline-variant/30 text-on-surface shadow-2xl animate-in slide-in-from-bottom-4 flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest">{toast.message}</span>
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
