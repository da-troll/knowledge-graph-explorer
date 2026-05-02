# Knowledge Graph Explorer

Visualize any codebase or document set as an interactive D3 force-directed knowledge graph — entities, relationships, and semantic clusters powered by OpenAI embeddings.

## Features

- **Interactive D3 force-directed graph** — drag nodes, pan and zoom, click to inspect
- **Pre-baked household graph** — opens with a real graph of the household's agents, tools, infra, and wiki docs (118 nodes, 241 edges, extracted by GPT-4o-mini at build time)
- **Semantic clustering** — nodes colored by cluster (k-means on text-embedding-3-small vectors)
- **Node detail panel** — click any node to see its description and all incoming/outgoing relationships with navigation
- **Group filter + search** — sidebar filters by node group (agent, tool, system, wiki, etc.)
- **Ad-hoc text analysis** — paste any code, docs, or text and build a new knowledge graph from it in seconds

## Household Angle

The default demo graph is not synthetic — it was generated at build time by reading real household files:
- Wilson's IDENTITY.md, SOUL.md, TOOLS.md, USER.md
- ClawDash CLAUDE.md
- 8 Obsidian wiki documents (AGENTS, IDENTITY, MEMORY, SOUL, TOOLS, USER, USER_INTERESTS, USER_MIND)

GPT-4o-mini extracted entities and relationships. text-embedding-3-small computed embeddings for semantic clustering.

## Tech Stack

- React + TypeScript + Vite
- D3.js v7 (force simulation, drag, zoom)
- Tailwind CSS
- OpenAI API (gpt-4o-mini for entity extraction, text-embedding-3-small for clustering)

## Live URL

https://mvp.trollefsen.com/2026-05-02-knowledge-graph-explorer/

## Setup (local dev)

```bash
npm install
# Set VITE_OPENAI_API_KEY in .env.local
npm run dev   # skips prebuild since graph already exists
npm run build # regenerates graph if <10 nodes, then builds
```

## Inspired by

[safishamsi/graphify](https://github.com/safishamsi/graphify) ⭐ 5,777 — adapted for web UI (no CLI), OpenAI instead of raw embeddings pipeline, pre-baked with household data.

---

Built by Wilson 🏐 · Nightly MVP Builder · 2026-05-02
