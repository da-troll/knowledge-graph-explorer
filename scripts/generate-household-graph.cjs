#!/usr/bin/env node
/**
 * Pre-build script: generates src/data/household-graph.json
 * Reads key household files, calls OpenAI to extract entities + relationships,
 * then clusters nodes using cosine similarity on embeddings.
 *
 * Runs as `npm run prebuild` before `vite build`.
 * Uses require() / CommonJS because this runs in Node.js directly (not bundled).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_FILE = path.join(__dirname, '../src/data/household-graph.json');

// Read key from env, then fall back to .env.local (Vite doesn't expose VITE_* to Node scripts)
function loadOpenAIKey() {
  if (process.env.VITE_OPENAI_API_KEY) return process.env.VITE_OPENAI_API_KEY;
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  // Parse .env.local
  const envFile = path.join(__dirname, '../.env.local');
  try {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^VITE_OPENAI_API_KEY=(.+)$/);
      if (m) return m[1].trim();
    }
  } catch { /* no .env.local */ }
  return null;
}

const OPENAI_KEY = loadOpenAIKey();

// ── Source files to process ─────────────────────────────────────────────────

const HOUSEHOLD_SOURCES = [
  {
    id: 'wilson-identity',
    label: 'Wilson — Identity',
    group: 'agent',
    file: '/home/eve/workspaces/wilson/IDENTITY.md',
  },
  {
    id: 'wilson-soul',
    label: 'Wilson — Soul',
    group: 'agent',
    file: '/home/eve/workspaces/wilson/SOUL.md',
  },
  {
    id: 'wilson-tools',
    label: 'Wilson — Tools & Infra',
    group: 'infra',
    file: '/home/eve/workspaces/wilson/TOOLS.md',
  },
  {
    id: 'wilson-user',
    label: 'Daniel — User Profile',
    group: 'user',
    file: '/home/eve/workspaces/wilson/USER.md',
  },
  {
    id: 'clawdash-claude',
    label: 'ClawDash — CLAUDE.md',
    group: 'project',
    file: '/opt/apps/clawdash/CLAUDE.md',
  },
];

// Also pull a sample of wiki docs
const WIKI_DIR = '/home/eve/obsidian/Home';
const WIKI_SOURCES_LIMIT = 8;

// ── Helpers ──────────────────────────────────────────────────────────────────

function readFileSafe(p) {
  try {
    const content = fs.readFileSync(p, 'utf8');
    return content.slice(0, 3000); // cap per-file context
  } catch {
    return null;
  }
}

function truncate(str, max = 200) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function openaiPost(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: `/v1/${endpoint}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_KEY}`,
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function extractEntitiesAndRelationships(sourceId, sourceLabel, content) {
  const prompt = `You are a knowledge graph builder. Analyze this document excerpt and extract:
1. Key concepts/entities (5-10 per document: tools, agents, patterns, systems, relationships)
2. Relationships between those entities (labeled edges)

Document: "${sourceLabel}"
---
${content}
---

Return ONLY valid JSON:
{
  "entities": [
    { "id": "unique_id", "label": "Display Name", "type": "agent|tool|pattern|system|concept|person", "description": "one sentence" }
  ],
  "relationships": [
    { "source": "entity_id", "target": "entity_id", "label": "relationship type" }
  ]
}

Keep entity IDs as snake_case. Extract real, specific entities — not generic placeholders.`;

  try {
    const res = await openaiPost('chat/completions', {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(res.choices?.[0]?.message?.content || '{}');
    return {
      entities: (parsed.entities || []).map((e) => ({ ...e, source_doc: sourceId })),
      relationships: parsed.relationships || [],
    };
  } catch (err) {
    console.warn(`  ⚠ Entity extraction failed for ${sourceId}: ${err.message}`);
    return { entities: [], relationships: [] };
  }
}

async function getEmbeddings(texts) {
  if (!texts.length) return [];
  try {
    const res = await openaiPost('embeddings', {
      model: 'text-embedding-3-small',
      input: texts,
    });
    return (res.data || []).map((d) => d.embedding);
  } catch (err) {
    console.warn(`  ⚠ Embeddings failed: ${err.message}`);
    return texts.map(() => null);
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function kMeansCluster(embeddings, k = 5, iterations = 20) {
  // Simple k-means on embedding vectors — returns cluster index per node
  if (embeddings.every((e) => !e)) return embeddings.map((_, i) => i % k);

  const valid = embeddings.filter(Boolean);
  if (valid.length < k) k = Math.max(1, valid.length);

  // Random centroids from first k valid embeddings
  let centroids = valid.slice(0, k);

  let assignments = new Array(embeddings.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    // Assign
    for (let i = 0; i < embeddings.length; i++) {
      if (!embeddings[i]) { assignments[i] = 0; continue; }
      let best = 0, bestSim = -Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const sim = cosineSimilarity(embeddings[i], centroids[c]);
        if (sim > bestSim) { bestSim = sim; best = c; }
      }
      assignments[i] = best;
    }
    // Update centroids
    const sums = Array.from({ length: k }, () => new Array(embeddings[0]?.length || 0).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < embeddings.length; i++) {
      if (!embeddings[i]) continue;
      const c = assignments[i];
      counts[c]++;
      for (let d = 0; d < embeddings[i].length; d++) sums[c][d] += embeddings[i][d];
    }
    centroids = sums.map((s, c) =>
      counts[c] > 0 ? s.map((v) => v / counts[c]) : centroids[c]
    );
  }

  return assignments;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Skip regeneration if a real graph (>10 nodes) already exists
  if (fs.existsSync(OUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
      if ((existing.node_count || 0) > 10) {
        console.log(`✓ Household graph already exists (${existing.node_count} nodes) — skipping regeneration.`);
        return;
      }
    } catch { /* corrupt — regenerate */ }
  }

  console.log('🔍 Generating household knowledge graph...');

  if (!OPENAI_KEY) {
    console.log('  No OPENAI_API_KEY found — using fallback static graph.');
    writeFallback();
    return;
  }

  // Collect sources
  const sources = [...HOUSEHOLD_SOURCES];

  // Add a sample of wiki docs
  try {
    const wikiEntries = fs.readdirSync(WIKI_DIR, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .slice(0, WIKI_SOURCES_LIMIT);
    for (const entry of wikiEntries) {
      sources.push({
        id: `wiki-${entry.name.replace('.md', '').toLowerCase().replace(/\s+/g, '-')}`,
        label: `Wiki: ${entry.name.replace('.md', '')}`,
        group: 'wiki',
        file: path.join(WIKI_DIR, entry.name),
      });
    }
  } catch {
    // wiki not accessible — continue without
  }

  const allEntities = [];
  const allRelationships = [];
  const docNodes = []; // source document nodes

  // Process each source
  for (const src of sources) {
    const content = readFileSafe(src.file);
    if (!content) {
      console.log(`  ⚠ Skipped (not found): ${src.file}`);
      continue;
    }
    console.log(`  Processing: ${src.label}`);

    // Add the document itself as a node
    docNodes.push({
      id: src.id,
      label: src.label,
      type: 'document',
      group: src.group,
      source_doc: src.id,
      description: `Source document: ${src.label}`,
    });

    const { entities, relationships } = await extractEntitiesAndRelationships(
      src.id,
      src.label,
      content
    );

    // Deduplicate entities by id
    for (const e of entities) {
      if (!allEntities.find((x) => x.id === e.id)) {
        allEntities.push(e);
      }
    }

    // Add doc→entity relationships
    for (const e of entities) {
      allRelationships.push({ source: src.id, target: e.id, label: 'contains' });
    }

    allRelationships.push(...relationships);
  }

  const allNodes = [...docNodes, ...allEntities];
  console.log(`  Extracted ${allNodes.length} nodes, ${allRelationships.length} relationships`);

  // Get embeddings for clustering
  console.log('  Computing embeddings for semantic clustering...');
  const texts = allNodes.map((n) => `${n.label}: ${n.description || ''}`);
  const embeddings = await getEmbeddings(texts);

  // K-means cluster
  const numClusters = Math.min(8, Math.ceil(allNodes.length / 3));
  const clusters = kMeansCluster(embeddings, numClusters);

  // Attach cluster + embedding (strip embedding to save space — just keep cluster)
  for (let i = 0; i < allNodes.length; i++) {
    allNodes[i].cluster = clusters[i];
  }

  // Filter relationships to only include nodes that exist
  const nodeIds = new Set(allNodes.map((n) => n.id));
  const validRelationships = allRelationships.filter(
    (r) => nodeIds.has(r.source) && nodeIds.has(r.target) && r.source !== r.target
  );

  const graph = {
    generated_at: new Date().toISOString(),
    source: 'household',
    node_count: allNodes.length,
    edge_count: validRelationships.length,
    nodes: allNodes.map((n) => ({
      id: n.id,
      label: truncate(n.label, 40),
      type: n.type || 'concept',
      group: n.group || 'concept',
      cluster: n.cluster,
      description: truncate(n.description || '', 150),
      source_doc: n.source_doc,
    })),
    edges: validRelationships.map((r) => ({
      source: r.source,
      target: r.target,
      label: r.label || 'related',
    })),
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(graph, null, 2));
  console.log(`✓ Household graph saved: ${allNodes.length} nodes, ${validRelationships.length} edges → ${OUT_FILE}`);
}

function writeFallback() {
  // Minimal static fallback if no API key
  const graph = {
    generated_at: new Date().toISOString(),
    source: 'household',
    node_count: 5,
    edge_count: 4,
    nodes: [
      { id: 'eve', label: 'Eve', type: 'agent', group: 'agent', cluster: 0, description: 'Household coordinator agent' },
      { id: 'wilson', label: 'Wilson', type: 'agent', group: 'agent', cluster: 0, description: 'Dev builder agent' },
      { id: 'clawdash', label: 'ClawDash', type: 'system', group: 'project', cluster: 1, description: 'Webchat UI' },
      { id: 'openai', label: 'OpenAI API', type: 'tool', group: 'infra', cluster: 2, description: 'LLM provider' },
      { id: 'supabase', label: 'Supabase', type: 'tool', group: 'infra', cluster: 2, description: 'Database & auth' },
    ],
    edges: [
      { source: 'wilson', target: 'clawdash', label: 'builds' },
      { source: 'wilson', target: 'openai', label: 'uses' },
      { source: 'clawdash', target: 'supabase', label: 'persists to' },
      { source: 'eve', target: 'wilson', label: 'coordinates' },
    ],
  };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(graph, null, 2));
  console.log(`✓ Fallback graph saved → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('Graph generation failed:', err);
  writeFallback();
});
