import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import type { GraphNode, GraphEdge } from '../types/graph'

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  onNodeClick: (node: GraphNode) => void
  selectedNodeId: string | null
  width: number
  height: number
}

// Color palette per cluster (up to 10 clusters)
const CLUSTER_COLORS = [
  '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
]

// Node size by type
function nodeRadius(type: string): number {
  switch (type) {
    case 'document': return 14
    case 'agent': return 12
    case 'system': return 11
    case 'tool': return 9
    case 'person': return 10
    default: return 8
  }
}

export function ForceGraph({ nodes, edges, onNodeClick, selectedNodeId, width, height }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphEdge> | null>(null)

  const stableOnNodeClick = useCallback(onNodeClick, [onNodeClick])

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Deep-copy nodes so D3 mutation doesn't affect React state
    const simNodes: GraphNode[] = nodes.map(n => ({ ...n }))
    const nodeMap = new Map(simNodes.map(n => [n.id, n]))

    const simEdges: { source: GraphNode; target: GraphNode; label: string }[] = edges
      .map(e => {
        const src = nodeMap.get(typeof e.source === 'string' ? e.source : (e.source as GraphNode).id)
        const tgt = nodeMap.get(typeof e.target === 'string' ? e.target : (e.target as GraphNode).id)
        if (!src || !tgt) return null
        return { source: src, target: tgt, label: e.label }
      })
      .filter(Boolean) as { source: GraphNode; target: GraphNode; label: string }[]

    // Container group with zoom
    const container = svg.append('g').attr('class', 'container')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => container.attr('transform', event.transform))
    svg.call(zoom)

    // Arrow markers per cluster color
    const defs = svg.append('defs')
    const uniqueClusters = [...new Set(simNodes.map(n => n.cluster))]
    uniqueClusters.forEach(c => {
      defs.append('marker')
        .attr('id', `arrow-${c}`)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 18)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', CLUSTER_COLORS[c % CLUSTER_COLORS.length])
        .attr('opacity', 0.6)
    })

    // Force simulation
    const sim = d3.forceSimulation<GraphNode>(simNodes)
      .force('link', d3.forceLink<GraphNode, { source: GraphNode; target: GraphNode; label: string }>(simEdges)
        .id(d => d.id)
        .distance(80)
        .strength(0.4))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>(d => nodeRadius(d.type) + 8))
      .force('cluster', clusterForce(simNodes, 0.05))

    simRef.current = sim

    // Edges
    const edgeGroup = container.append('g').attr('class', 'edges')
    const edgeLine = edgeGroup.selectAll('line')
      .data(simEdges)
      .enter().append('line')
      .attr('stroke', d => CLUSTER_COLORS[(d.source as GraphNode).cluster % CLUSTER_COLORS.length])
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1.5)
      .attr('marker-end', d => `url(#arrow-${(d.source as GraphNode).cluster})`)

    const edgeLabel = edgeGroup.selectAll('text.edge-label')
      .data(simEdges)
      .enter().append('text')
      .attr('class', 'edge-label')
      .attr('font-size', 9)
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .text(d => d.label)

    // Nodes
    const nodeGroup = container.append('g').attr('class', 'nodes')
    const nodeCircle = nodeGroup.selectAll('g.node')
      .data(simNodes)
      .enter().append('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart()
            d.fx = d.x; d.fy = d.y
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
          .on('end', (event, d) => {
            if (!event.active) sim.alphaTarget(0)
            d.fx = null; d.fy = null
          })
      )
      .on('click', (_event, d) => stableOnNodeClick(d))

    // Glow ring for selected
    nodeCircle.append('circle')
      .attr('class', 'ring')
      .attr('r', d => nodeRadius(d.type) + 5)
      .attr('fill', 'none')
      .attr('stroke', d => CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length])
      .attr('stroke-width', 2)
      .attr('opacity', d => d.id === selectedNodeId ? 0.9 : 0)

    nodeCircle.append('circle')
      .attr('r', d => nodeRadius(d.type))
      .attr('fill', d => CLUSTER_COLORS[d.cluster % CLUSTER_COLORS.length])
      .attr('fill-opacity', d => d.type === 'document' ? 0.9 : 0.75)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1.5)

    // Label below node
    nodeCircle.append('text')
      .attr('dy', d => nodeRadius(d.type) + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('fill', '#d1d5db')
      .attr('pointer-events', 'none')
      .text(d => d.label.length > 22 ? d.label.slice(0, 20) + '…' : d.label)

    // Simulation tick
    sim.on('tick', () => {
      edgeLine
        .attr('x1', d => (d.source as GraphNode).x ?? 0)
        .attr('y1', d => (d.source as GraphNode).y ?? 0)
        .attr('x2', d => (d.target as GraphNode).x ?? 0)
        .attr('y2', d => (d.target as GraphNode).y ?? 0)

      edgeLabel
        .attr('x', d => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr('y', d => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2)

      nodeCircle.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => { sim.stop() }
  }, [nodes, edges, width, height, stableOnNodeClick, selectedNodeId])

  // Update ring opacity when selection changes without full redraw
  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current).selectAll<SVGCircleElement, GraphNode>('circle.ring')
      .attr('opacity', d => d.id === selectedNodeId ? 0.9 : 0)
  }, [selectedNodeId])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="bg-gray-950 rounded-xl"
      style={{ cursor: 'grab' }}
    />
  )
}

// Custom cluster force — pulls nodes toward their cluster centroid
function clusterForce(nodes: GraphNode[], strength: number) {
  return function() {
    const clusterCenters: Record<number, { x: number; y: number; count: number }> = {}
    nodes.forEach(n => {
      const c = n.cluster
      if (!clusterCenters[c]) clusterCenters[c] = { x: 0, y: 0, count: 0 }
      clusterCenters[c].x += n.x ?? 0
      clusterCenters[c].y += n.y ?? 0
      clusterCenters[c].count++
    })
    Object.values(clusterCenters).forEach(c => { c.x /= c.count; c.y /= c.count })
    nodes.forEach(n => {
      const c = clusterCenters[n.cluster]
      if (!c) return
      n.vx = (n.vx ?? 0) + (c.x - (n.x ?? 0)) * strength
      n.vy = (n.vy ?? 0) + (c.y - (n.y ?? 0)) * strength
    })
  }
}
