# Knowledge Graph Explorer — Build Plan

## What it does
Visualizes knowledge as an interactive D3 force-directed graph. Users can explore pre-baked graphs or analyze custom text to build new ones.

## Household fit
Personal tooling for Daniel + household infrastructure visualization. The default demo shows the household's own knowledge graph — real entities extracted from agent docs + wiki files.

## Scoped MVP
1. Pre-baked household graph (build-time generation via OpenAI)
2. D3 force-directed interactive visualization
3. Node detail panel (description + relationship navigation)
4. Group filter + search sidebar
5. Custom text analysis panel (ad-hoc graph building)

## Real data
- Wilson IDENTITY.md, SOUL.md, TOOLS.md, USER.md
- ClawDash CLAUDE.md
- 8 Obsidian wiki docs

## Build tasks
- [x] Scaffold + package.json
- [x] Pre-generation script (generate-household-graph.cjs) — reads household files, calls gpt-4o-mini + text-embedding-3-small
- [x] TypeScript types
- [x] OpenAI client (entity extraction + k-means clustering)
- [x] D3 ForceGraph component (force sim, drag, zoom, arrows)
- [x] NodeDetail panel
- [x] AnalyzePanel (custom text input)
- [x] App.tsx (layout + state)
- [x] Build passes — 118 nodes, 241 edges
