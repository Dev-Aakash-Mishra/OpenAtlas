import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import EventNode from './nodes/EventNode';
import DetailPanel from './components/DetailPanel';
import Legend from './components/Legend';
import ChatPanel from './components/ChatPanel';
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

  const sorted = [...graphData].sort(
    (a, b) => (connectionCount[b.id] || 0) - (connectionCount[a.id] || 0)
  );

  const placed = {};
  const nodes = [];
  const centerX = 600;
  const centerY = 400;

  sorted.forEach((n, i) => {
    const conns = connectionCount[n.id] || 0;
    let x, y;

    if (conns > 3) {
      const hubNodes = sorted.filter(s => connectionCount[s.id] > 3);
      const angle = (hubNodes.indexOf(n) / Math.max(hubNodes.length, 1)) * Math.PI * 2;
      const radius = 200;
      x = centerX + Math.cos(angle) * radius;
      y = centerY + Math.sin(angle) * radius;
    } else if (conns > 0) {
      const linked = [...(n.prev || []), ...(n.next || [])];
      const placedParent = linked.find((id) => placed[id]);
      if (placedParent) {
        const parent = placed[placedParent];
        const angle = Math.random() * Math.PI * 2;
        const dist = 250 + Math.random() * 100;
        x = parent.x + Math.cos(angle) * dist;
        y = parent.y + Math.sin(angle) * dist;
      } else {
        const ring = 500 + Math.random() * 200;
        const angle = (i / sorted.length) * Math.PI * 2;
        x = centerX + Math.cos(angle) * ring;
        y = centerY + Math.sin(angle) * ring;
      }
    } else {
      const cols = 6;
      const orphanIndex = sorted.filter((s, si) => si <= i && connectionCount[s.id] === 0).length - 1;
      x = -600 + (orphanIndex % cols) * 320;
      y = 900 + Math.floor(orphanIndex / cols) * 280;
    }

    placed[n.id] = { x, y };

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
      style: { width: size },
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
  const [graphData, setGraphData] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState('all');
  const [chatOpen, setChatOpen] = useState(false);
  const [fontIdx, setFontIdx] = useState(DEFAULT_FONT_IDX);

  const fontSize = FONT_SIZES[fontIdx];

  useEffect(() => {
    fetch(`${API_BASE}/api/graph`)
      .then((r) => r.json())
      .then((data) => setGraphData(data))
      .catch(() => {
        fetch('/graph.json')
          .then((r) => r.json())
          .then((data) => setGraphData(data));
      });
  }, []);

  useEffect(() => {
    if (!graphData.length) return;

    let filtered = graphData;

    if (filterDomain !== 'all') {
      const domainIds = new Set(
        graphData.filter((n) => n.domain === filterDomain).map((n) => n.id)
      );
      filtered = graphData.filter(
        (n) =>
          n.domain === filterDomain ||
          (n.next || []).some((id) => domainIds.has(id)) ||
          (n.prev || []).some((id) => domainIds.has(id))
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const isUuid = /^[a-f0-9-]{8,36}$/.test(q);

      if (isUuid) {
        filtered = filtered.filter((n) => n.id.startsWith(q) || n.id === q);
      } else {
        filtered = filtered.filter(
          (n) =>
            n.content.toLowerCase().includes(q) ||
            (n.key_elements || []).some((k) => k.toLowerCase().includes(q))
        );
      }
    }

    setNodes(layoutNodes(filtered));
    setEdges(buildEdges(filtered));
  }, [graphData, filterDomain, searchQuery]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node.data);
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
         setCenter(rfNode.position.x + rfNode.data.size/2, rfNode.position.y + 100, { zoom: 1.2, duration: 800 });
      }
    }
  }, [graphData, nodes, setCenter]);

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

      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search events, entities, or paste a node UUID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="toolbar-controls">
          <div className="font-controls global-font-controls">
            <button
              className="font-btn"
              onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
              disabled={fontIdx === 0}
            >
              A-
            </button>
            <span className="font-size-label">{fontSize}px</span>
            <button
              className="font-btn"
              onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
              disabled={fontIdx === FONT_SIZES.length - 1}
            >
              A+
            </button>
          </div>
          <select
            className="domain-filter"
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
          <button
            className={`chat-toggle ${chatOpen ? 'active' : ''}`}
            onClick={() => setChatOpen(!chatOpen)}
          >
            {chatOpen ? '✕ Close Chat' : '◉ Atlas Chat'}
          </button>
        </div>
      </div>

      <div className="canvas-wrapper">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={30} size={1} />
          <Controls className="flow-controls" showInteractive={false} />
          <MiniMap
            nodeColor={(n) => n.data?.color || '#475569'}
            maskColor="rgba(0,0,0,0.7)"
            className="flow-minimap"
          />
        </ReactFlow>

        <Legend domains={domains} colors={DOMAIN_COLORS} />

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
          />
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
