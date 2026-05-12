import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import OpenAI                        from 'openai'
import * as pdfModule from 'pdf-parse'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdf = (pdfModule as any).default ?? pdfModule

// ── Service-role Supabase client (bypasses RLS) ───────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── OpenAI embeddings ─────────────────────────────────────────────────────────
function openaiClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
}

async function embed(text: string): Promise<number[]> {
  const res = await openaiClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  return res.data[0].embedding
}

// ── Text chunker ──────────────────────────────────────────────────────────────
function chunkText(text: string, chunkSize = 600, overlap = 100): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/)
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > chunkSize && current.length > 0) {
      chunks.push(current.trim())
      // overlap: carry last `overlap` chars into next chunk
      const tail = current.slice(-overlap)
      current = tail + ' ' + sentence
    } else {
      current = current ? current + ' ' + sentence : sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.filter(c => c.length > 50) // discard tiny fragments
}

// ── POST /api/syndicate/upload ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const form       = await req.formData()
    const coachName  = (form.get('coach_name')   as string)?.toUpperCase()
    const srcTitle   = (form.get('source_title')  as string) ?? ''
    const srcAuthor  = (form.get('source_author') as string) ?? ''
    const file       = form.get('file') as File | null

    const validCoaches = ['ATLAS', 'FORGE', 'IRON', 'HAVEN', 'APEX', 'COMPASS']
    if (!coachName || !validCoaches.includes(coachName)) {
      return NextResponse.json({ error: 'Invalid coach_name' }, { status: 400 })
    }
    if (!srcTitle) {
      return NextResponse.json({ error: 'source_title is required' }, { status: 400 })
    }
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    // Extract text from PDF
    const buffer     = Buffer.from(await file.arrayBuffer())
    const parsed     = await pdf(buffer)
    const rawText    = parsed.text

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from PDF' }, { status: 422 })
    }

    // Chunk
    const chunks = chunkText(rawText)
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No usable text chunks found' }, { status: 422 })
    }

    // Embed + upsert
    const supabase = adminClient()
    let inserted   = 0

    for (const chunk of chunks) {
      const embedding = await embed(chunk)

      const { error } = await supabase.from('syndicate_knowledge').insert({
        coach_name:    coachName,
        source_title:  srcTitle,
        source_author: srcAuthor,
        content_chunk: chunk,
        embedding,
      })

      if (error) {
        console.error('Insert error:', error.message)
      } else {
        inserted++
      }
    }

    return NextResponse.json({
      success: true,
      chunks:  chunks.length,
      inserted,
      coach:   coachName,
      title:   srcTitle,
    })

  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
