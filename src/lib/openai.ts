import OpenAI from 'openai'
import type { GraphNode, GraphEdge } from '../types/graph'

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
  dangerouslyAllowBrowser: true,
})

export async function analyzeText(text: string, title = 'Document'): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const prompt = `You are a knowledge graph builder. Analyze this text and extract key concepts and their relationships.

Title: "${title}"
---
${text.slice(0, 8000)}
---

Extract:
- 8-20 key entities/concepts (files, modules, patterns, tools, agents, people, systems)
- Relationships between them (directional, labeled)

Return ONLY valid JSON:
{
  "entities": [
    { "id": "snake_case_id", "label": "Display Label", "type": "agent|tool|pattern|system|concept|person|file", "description": "one sentence about this entity" }
  ],
  "relationships": [
    { "source": "entity_id", "target": "entity_id", "label": "relationship type (e.g. uses, imports, depends_on, manages, sends_to)" }
  ]
}`

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })

  const raw = JSON.parse(res.choices[0].message.content || '{}')
  const entities: GraphNode[] = (raw.entities || []).map((e: Record<string, string>, i: number) => ({
    id: e.id || `node_${i}`,
    label: e.label || e.id,
    type: e.type || 'concept',
    group: e.type || 'concept',
    cluster: 0,
    description: e.description || '',
  }))

  // Get embeddings for semantic clustering
  if (entities.length > 2) {
    try {
      const texts = entities.map(e => `${e.label}: ${e.description}`)
      const embRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      })
      const embeddings = embRes.data.map(d => d.embedding)
      const clusters = kMeans(embeddings, Math.min(5, Math.ceil(entities.length / 3)))
      entities.forEach((e, i) => { e.cluster = clusters[i] })
    } catch {
      // Non-critical — fallback to type-based cluster
      const types = [...new Set(entities.map(e => e.type))]
      entities.forEach(e => { e.cluster = types.indexOf(e.type) })
    }
  }

  const nodeIds = new Set(entities.map(e => e.id))
  const edges: GraphEdge[] = (raw.relationships || [])
    .filter((r: Record<string, string>) => nodeIds.has(r.source) && nodeIds.has(r.target) && r.source !== r.target)
    .map((r: Record<string, string>) => ({ source: r.source, target: r.target, label: r.label || 'related' }))

  return { nodes: entities, edges }
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function kMeans(embeddings: number[][], k: number, iters = 15): number[] {
  if (k <= 1) return embeddings.map(() => 0)
  let centroids = embeddings.slice(0, k)
  let assignments = new Array(embeddings.length).fill(0)
  for (let iter = 0; iter < iters; iter++) {
    for (let i = 0; i < embeddings.length; i++) {
      let best = 0, bestSim = -Infinity
      for (let c = 0; c < centroids.length; c++) {
        const s = cosineSim(embeddings[i], centroids[c])
        if (s > bestSim) { bestSim = s; best = c }
      }
      assignments[i] = best
    }
    const dim = embeddings[0].length
    const sums = Array.from({ length: k }, () => new Array(dim).fill(0))
    const counts = new Array(k).fill(0)
    embeddings.forEach((e, i) => { counts[assignments[i]]++; e.forEach((v, d) => { sums[assignments[i]][d] += v }) })
    centroids = sums.map((s, c) => counts[c] > 0 ? s.map(v => v / counts[c]) : centroids[c])
  }
  return assignments
}
