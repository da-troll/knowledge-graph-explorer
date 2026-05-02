import { useState } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { analyzeText } from '../lib/openai'
import type { GraphNode, GraphEdge } from '../types/graph'

interface Props {
  onResult: (nodes: GraphNode[], edges: GraphEdge[], title: string) => void
}

export function AnalyzePanel({ onResult }: Props) {
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await analyzeText(text, title || 'Custom Document')
      onResult(result.nodes, result.edges, title || 'Custom Document')
      setText('')
      setTitle('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-green-400" />
        Analyze Custom Text
      </h3>
      <div className="space-y-2">
        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-green-500"
          placeholder="Title (optional)"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <textarea
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-green-500 resize-none"
          rows={5}
          placeholder="Paste code, docs, or any text to visualize its knowledge graph…"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}
        <button
          className="w-full bg-green-600 hover:bg-green-500 text-white text-sm font-medium py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={analyze}
          disabled={loading || !text.trim()}
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Build Graph
            </>
          )}
        </button>
      </div>
    </div>
  )
}
