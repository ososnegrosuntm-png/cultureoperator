'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
type CoachKey = 'ATLAS' | 'FORGE' | 'IRON' | 'HAVEN' | 'APEX' | 'COMPASS'

type KnowledgeChunk = {
  id: string
  coach_name: CoachKey
  source_title: string
  source_author: string
  content_chunk: string
  created_at: string
}

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

// ── Coach config ──────────────────────────────────────────────────────────────
const COACHES: { key: CoachKey; role: string; color: string }[] = [
  { key: 'ATLAS',   role: 'Fitness',    color: 'text-gold' },
  { key: 'IRON',    role: 'Mental',     color: 'text-bone' },
  { key: 'FORGE',   role: 'Nutrition',  color: 'text-[#e8963d]' },
  { key: 'HAVEN',   role: 'Recovery',   color: 'text-[#7db8c8]' },
  { key: 'APEX',    role: 'Business',   color: 'text-[#a8c49a]' },
  { key: 'COMPASS', role: 'Synthesis',  color: 'text-bone/80' },
]

// ── SyndicateKnowledge ────────────────────────────────────────────────────────
export function SyndicateKnowledge() {
  const supabase = createClient()

  const [activeCoach, setActiveCoach] = useState<CoachKey>('ATLAS')
  const [sourceTitle,  setSourceTitle]  = useState('')
  const [sourceAuthor, setSourceAuthor] = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [uploadState,  setUploadState]  = useState<UploadState>('idle')
  const [uploadMsg,    setUploadMsg]    = useState('')
  const [chunks,       setChunks]       = useState<KnowledgeChunk[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load chunks for active coach ──────────────────────────────────────────
  const loadChunks = useCallback(async (coach: CoachKey) => {
    setLoadingChunks(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('syndicate_knowledge')
      .select('id, coach_name, source_title, source_author, content_chunk, created_at')
      .eq('coach_name', coach)
      .order('created_at', { ascending: false })
      .limit(50)

    setChunks((data as KnowledgeChunk[]) ?? [])
    setLoadingChunks(false)
  }, [supabase])

  useEffect(() => {
    loadChunks(activeCoach)
  }, [activeCoach, loadChunks])

  // ── Upload handler ─────────────────────────────────────────────────────────
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !sourceTitle) return

    setUploadState('uploading')
    setUploadMsg('Extracting text and generating embeddings…')

    const form = new FormData()
    form.append('coach_name',    activeCoach)
    form.append('source_title',  sourceTitle)
    form.append('source_author', sourceAuthor)
    form.append('file',          file)

    try {
      const res  = await fetch('/api/syndicate/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setUploadState('error')
        setUploadMsg(data.error ?? 'Upload failed')
        return
      }

      setUploadState('done')
      setUploadMsg(`✓ ${data.inserted} chunks embedded and stored from "${data.title}"`)
      setSourceTitle('')
      setSourceAuthor('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      loadChunks(activeCoach)

    } catch (err) {
      setUploadState('error')
      setUploadMsg(err instanceof Error ? err.message : 'Network error')
    }
  }

  // ── Delete chunk ───────────────────────────────────────────────────────────
  async function deleteChunk(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('syndicate_knowledge').delete().eq('id', id)
    setChunks(prev => prev.filter(c => c.id !== id))
  }

  // ── Group chunks by source ────────────────────────────────────────────────
  const grouped = chunks.reduce<Record<string, KnowledgeChunk[]>>((acc, c) => {
    const key = `${c.source_title}${c.source_author ? ' — ' + c.source_author : ''}`
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const activeCoachConfig = COACHES.find(c => c.key === activeCoach)!

  return (
    <div className="min-h-full bg-bone">

      {/* Header */}
      <div className="bg-ink border-b border-bone/8 px-10 py-8">
        <p className="text-xs tracking-widest uppercase text-gold/50 font-medium">The Syndicate</p>
        <h1 className="font-serif text-3xl font-bold text-bone mt-1">
          Knowledge <span className="text-gold">Base</span>
        </h1>
        <p className="text-sm text-bone/40 mt-1.5">
          Upload PDFs to build each coach&apos;s methodology library. Chunks are embedded and retrieved at message generation time.
        </p>
      </div>

      <div className="px-10 py-8 max-w-4xl">

        {/* Coach tabs */}
        <div className="flex gap-1 mb-8 border-b border-bone-deeper">
          {COACHES.map(coach => (
            <button
              key={coach.key}
              onClick={() => setActiveCoach(coach.key)}
              className={`px-5 py-2.5 text-[10px] tracking-widest uppercase font-bold transition-colors border-b-2 -mb-px ${
                activeCoach === coach.key
                  ? `${coach.color} border-current`
                  : 'text-ink-muted border-transparent hover:text-ink'
              }`}
            >
              {coach.key}
            </button>
          ))}
        </div>

        {/* Upload form */}
        <div className="border border-bone-deeper mb-8">
          <div className="bg-ink px-6 py-4">
            <h2 className={`font-serif text-xl font-bold ${activeCoachConfig.color}`}>
              {activeCoach}
              <span className="text-xs font-sans font-normal text-bone/40 ml-3 tracking-widest uppercase">
                {activeCoachConfig.role} Coach
              </span>
            </h2>
            <p className="text-xs text-bone/40 mt-1">
              Upload source material to ground {activeCoach}&apos;s message generation in elite methodology.
            </p>
          </div>

          <form onSubmit={handleUpload} className="px-6 py-6 space-y-4 bg-bone">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] tracking-widest uppercase font-semibold text-ink-muted mb-1.5">
                  Source Title *
                </label>
                <input
                  type="text"
                  value={sourceTitle}
                  onChange={e => setSourceTitle(e.target.value)}
                  placeholder="e.g. 100M Offers — Chapter 3"
                  required
                  className="w-full px-3 py-2 text-xs bg-white border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-widest uppercase font-semibold text-ink-muted mb-1.5">
                  Author
                </label>
                <input
                  type="text"
                  value={sourceAuthor}
                  onChange={e => setSourceAuthor(e.target.value)}
                  placeholder="e.g. Alex Hormozi"
                  className="w-full px-3 py-2 text-xs bg-white border border-bone-deeper text-ink placeholder:text-ink-muted/50 focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] tracking-widest uppercase font-semibold text-ink-muted mb-1.5">
                PDF File *
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-bone-deeper hover:border-gold transition-colors cursor-pointer px-6 py-8 text-center"
              >
                {file ? (
                  <div>
                    <p className="text-xs font-semibold text-ink">{file.name}</p>
                    <p className="text-[10px] text-ink-muted mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto mb-2 text-ink-muted/50" width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M14 2v6h6M12 12v6M9 15l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <p className="text-xs text-ink-muted">Click to select a PDF file</p>
                    <p className="text-[10px] text-ink-muted/50 mt-1">Text will be extracted, chunked, and embedded</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Status message */}
            {uploadMsg && (
              <div className={`text-xs px-4 py-2.5 border ${
                uploadState === 'done'  ? 'bg-gold/5 border-gold/30 text-gold' :
                uploadState === 'error' ? 'bg-[#b45454]/5 border-[#b45454]/30 text-[#b45454]' :
                'bg-ink/5 border-bone-deeper text-ink-muted'
              }`}>
                {uploadState === 'uploading' && (
                  <span className="inline-block w-3 h-3 border border-ink-muted/50 border-t-gold rounded-full animate-spin mr-2 align-middle" />
                )}
                {uploadMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!file || !sourceTitle || uploadState === 'uploading'}
              className="text-[10px] tracking-widest uppercase font-bold bg-ink text-bone px-6 py-3 hover:bg-ink/90 transition-colors disabled:opacity-40"
            >
              {uploadState === 'uploading' ? 'Processing…' : `Upload to ${activeCoach} Knowledge Base`}
            </button>
          </form>
        </div>

        {/* Existing knowledge */}
        <div className="border border-bone-deeper">
          <div className="px-6 py-4 border-b border-bone-deeper bg-bone flex items-center justify-between">
            <p className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted">
              {activeCoach} Knowledge Base
            </p>
            <p className="text-xs text-ink-muted">
              {chunks.length} chunk{chunks.length !== 1 ? 's' : ''} stored
            </p>
          </div>

          {loadingChunks ? (
            <div className="px-6 py-8 text-center">
              <span className="inline-block w-4 h-4 border border-bone-deeper border-t-gold rounded-full animate-spin" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-xs text-ink-muted">No knowledge uploaded for {activeCoach} yet.</p>
              <p className="text-[10px] text-ink-muted/60 mt-1">Upload a PDF above to populate this coach&apos;s methodology library.</p>
            </div>
          ) : (
            <div className="divide-y divide-bone-deeper">
              {Object.entries(grouped).map(([sourceKey, sourceChunks]) => (
                <div key={sourceKey}>
                  <div className="px-6 py-3 bg-ink/3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-ink">{sourceChunks[0].source_title}</p>
                      {sourceChunks[0].source_author && (
                        <p className="text-[10px] text-ink-muted">{sourceChunks[0].source_author}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-ink-muted font-medium">
                      {sourceChunks.length} chunk{sourceChunks.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {sourceChunks.slice(0, 3).map((chunk) => (
                    <div key={chunk.id} className="px-6 py-3 group flex items-start gap-4 hover:bg-bone-dark transition-colors">
                      <p className="flex-1 text-xs text-ink-muted leading-relaxed line-clamp-2">
                        {chunk.content_chunk}
                      </p>
                      <button
                        onClick={() => deleteChunk(chunk.id)}
                        className="shrink-0 text-[10px] tracking-widest uppercase text-ink-muted/40 hover:text-[#b45454] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {sourceChunks.length > 3 && (
                    <p className="px-6 py-2 text-[10px] text-ink-muted/60 italic">
                      + {sourceChunks.length - 3} more chunks
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
