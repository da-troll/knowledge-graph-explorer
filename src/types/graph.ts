export interface GraphNode {
  id: string
  label: string
  type: 'agent' | 'tool' | 'pattern' | 'system' | 'concept' | 'person' | 'document' | string
  group: string
  cluster: number
  description: string
  source_doc?: string
  // D3 simulation adds these
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphEdge {
  source: string | GraphNode
  target: string | GraphNode
  label: string
}

export interface GraphData {
  generated_at: string
  source: string
  node_count: number
  edge_count: number
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface AnalysisResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
