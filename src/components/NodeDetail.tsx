import { X, Network } from 'lucide-react'
import type { GraphNode, GraphEdge } from '../types/graph'

interface Props {
  node: GraphNode
  edges: GraphEdge[]
  allNodes: GraphNode[]
  onClose: () => void
  onNavigate: (id: string) => void
}

function resolveId(n: string | GraphNode): string {
  return typeof n === 'string' ? n : n.id
}

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  agent:    { bg: 'bg-green-900', text: 'text-green-300' },
  tool:     { bg: 'bg-blue-900',  text: 'text-blue-300' },
  system:   { bg: 'bg-purple-900', text: 'text-purple-300' },
  document: { bg: 'bg-yellow-900', text: 'text-yellow-300' },
  concept:  { bg: 'bg-gray-700',   text: 'text-gray-300' },
  person:   { bg: 'bg-pink-900',   text: 'text-pink-300' },
  pattern:  { bg: 'bg-orange-900', text: 'text-orange-300' },
  file:     { bg: 'bg-teal-900',   text: 'text-teal-300' },
}

export function NodeDetail({ node, edges, allNodes, onClose, onNavigate }: Props) {
  const nodeMap = new Map(allNodes.map(n => [n.id, n]))

  const outgoing = edges.filter(e => resolveId(e.source) === node.id)
  const incoming = edges.filter(e => resolveId(e.target) === node.id)

  const badge = TYPE_BADGE[node.type] ?? TYPE_BADGE.concept

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 w-72 flex-shrink-0">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Network className="w-4 h-4 text-green-400 flex-shrink-0" />
          <h2 className="font-semibold text-sm text-white truncate">{node.label}</h2>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} mb-3`}>
        {node.type}
      </span>

      {node.description && (
        <p className="text-xs text-gray-400 leading-relaxed mb-4">{node.description}</p>
      )}

      {(outgoing.length > 0 || incoming.length > 0) && (
        <div className="space-y-3">
          {outgoing.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Outgoing ({outgoing.length})
              </h3>
              <div className="space-y-1">
                {outgoing.slice(0, 8).map((e, i) => {
                  const targetId = resolveId(e.target)
                  const target = nodeMap.get(targetId)
                  return (
                    <button
                      key={i}
                      className="w-full text-left flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 hover:bg-gray-800 transition-colors group"
                      onClick={() => onNavigate(targetId)}
                    >
                      <span className="text-gray-500 flex-shrink-0">→</span>
                      <span className="text-green-400 text-xs flex-shrink-0">{e.label}</span>
                      <span className="text-gray-300 truncate group-hover:text-white">{target?.label ?? targetId}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {incoming.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Incoming ({incoming.length})
              </h3>
              <div className="space-y-1">
                {incoming.slice(0, 8).map((e, i) => {
                  const srcId = resolveId(e.source)
                  const src = nodeMap.get(srcId)
                  return (
                    <button
                      key={i}
                      className="w-full text-left flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 hover:bg-gray-800 transition-colors group"
                      onClick={() => onNavigate(srcId)}
                    >
                      <span className="text-gray-500 flex-shrink-0">←</span>
                      <span className="text-blue-400 text-xs flex-shrink-0">{e.label}</span>
                      <span className="text-gray-300 truncate group-hover:text-white">{src?.label ?? srcId}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
