import { useState, useEffect, useCallback, useRef } from 'react'
import { Network, Search, RotateCcw, Layers } from 'lucide-react'
import { ForceGraph } from './components/ForceGraph'
import { NodeDetail } from './components/NodeDetail'
import { AnalyzePanel } from './components/AnalyzePanel'
import type { GraphNode, GraphEdge, GraphData } from './types/graph'
import householdGraph from './data/household-graph.json'

const CLUSTER_COLORS = [
  '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

function useContainerSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 800, height: 600 })
  useEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref])
  return size
}

export default function App() {
  const graph = householdGraph as GraphData

  const [nodes, setNodes] = useState<GraphNode[]>(graph.nodes)
  const [edges, setEdges] = useState<GraphEdge[]>(graph.edges)
  const [graphTitle, setGraphTitle] = useState('Household Knowledge Graph')
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [search, setSearch] = useState('')
  const [filterGroup, setFilterGroup] = useState<string>('all')
  const [showAnalyze, setShowAnalyze] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useContainerSize(containerRef)

  const groups = ['all', ...Array.from(new Set(nodes.map(n => n.group))).sort()]

  const filteredNodes = nodes.filter(n => {
    const matchSearch = !search || n.label.toLowerCase().includes(search.toLowerCase()) || n.description.toLowerCase().includes(search.toLowerCase())
    const matchGroup = filterGroup === 'all' || n.group === filterGroup
    return matchSearch && matchGroup
  })

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = edges.filter(e => {
    const src = typeof e.source === 'string' ? e.source : (e.source as GraphNode).id
    const tgt = typeof e.target === 'string' ? e.target : (e.target as GraphNode).id
    return filteredNodeIds.has(src) && filteredNodeIds.has(tgt)
  })

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  const handleNavigate = useCallback((id: string) => {
    const n = nodes.find(n => n.id === id)
    if (n) setSelectedNode(n)
  }, [nodes])

  const handleAnalysisResult = (newNodes: GraphNode[], newEdges: GraphEdge[], title: string) => {
    setNodes(newNodes)
    setEdges(newEdges)
    setGraphTitle(title)
    setSelectedNode(null)
    setSearch('')
    setFilterGroup('all')
    setShowAnalyze(false)
  }

  const resetToHousehold = () => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
    setGraphTitle('Household Knowledge Graph')
    setSelectedNode(null)
    setSearch('')
    setFilterGroup('all')
  }

  const clusters = [...new Set(nodes.map(n => n.cluster))].sort()

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-800 bg-gray-950/90 backdrop-blur z-10 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-green-600 rounded-md flex items-center justify-center">
            <Network className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-sm text-white">Knowledge Graph Explorer</span>
          <span className="text-xs text-gray-500 hidden sm:block">— {graphTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{filteredNodes.length} nodes · {filteredEdges.length} edges</span>
          <button
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            onClick={() => setShowAnalyze(!showAnalyze)}
          >
            <Layers className="w-3.5 h-3.5" />
            Analyze Text
          </button>
          {graphTitle !== 'Household Knowledge Graph' && (
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
              onClick={resetToHousehold}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Household
            </button>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-500" />
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-green-500"
                placeholder="Search nodes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Group filter */}
          <div className="p-3 border-b border-gray-800 space-y-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Groups</p>
            {groups.map(g => (
              <button
                key={g}
                className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors ${filterGroup === g ? 'bg-green-900 text-green-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
                onClick={() => setFilterGroup(g)}
              >
                {g}
                <span className="float-right text-gray-600">
                  {g === 'all' ? nodes.length : nodes.filter(n => n.group === g).length}
                </span>
              </button>
            ))}
          </div>

          {/* Cluster legend */}
          <div className="p-3 overflow-y-auto flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Clusters</p>
            {clusters.map(c => (
              <div key={c} className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CLUSTER_COLORS[c % CLUSTER_COLORS.length] }}
                />
                <span className="text-xs text-gray-400">Cluster {c}</span>
                <span className="text-xs text-gray-600 ml-auto">
                  {nodes.filter(n => n.cluster === c).length}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          <ForceGraph
            nodes={filteredNodes}
            edges={filteredEdges}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedNode?.id ?? null}
            width={width}
            height={height}
          />

          {/* Controls hint */}
          <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none">
            Drag to pan · Scroll to zoom · Click node to inspect
          </div>
        </div>

        {/* Right panel — node detail or analyze */}
        <div className="w-72 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-3 space-y-3">
          {showAnalyze && (
            <AnalyzePanel onResult={handleAnalysisResult} />
          )}
          {selectedNode && (
            <NodeDetail
              node={selectedNode}
              edges={edges}
              allNodes={nodes}
              onClose={() => setSelectedNode(null)}
              onNavigate={handleNavigate}
            />
          )}
          {!showAnalyze && !selectedNode && (
            <div className="text-xs text-gray-600 pt-4 text-center">
              <Network className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Click a node to inspect it</p>
              <p className="mt-1">or use <span className="text-gray-400">Analyze Text</span> to build a graph from custom input</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
