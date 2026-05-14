#!/usr/bin/env tsx
/**
 * seed-syndicate-knowledge.ts
 * Reads syndicate-docs/*.md, chunks by H2/H3, embeds via OpenAI,
 * upserts into syndicate_knowledge (production Supabase).
 *
 * Usage:
 *   npx tsx scripts/seed-syndicate-knowledge.ts [--dry-run]
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 */

import fs   from 'fs'
import path from 'path'

// ── Load .env.local manually (no dotenv dep issues) ───────────────────────────
function loadEnv(filePath: string): Record<string, string> {
  const env: Record<string, string> = {}
  if (!fs.existsSync(filePath)) return env
  const raw = fs.readFileSync(filePath, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const envFile = path.resolve(process.cwd(), '.env.local')
const envVars = loadEnv(envFile)

const SUPABASE_URL      = envVars.NEXT_PUBLIC_SUPABASE_URL      ?? process.env.NEXT_PUBLIC_SUPABASE_URL      ?? ''
const SERVICE_ROLE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY     ?? process.env.SUPABASE_SERVICE_ROLE_KEY     ?? ''
const OPENAI_API_KEY    = envVars.OPENAI_API_KEY                ?? process.env.OPENAI_API_KEY                ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('❌ Missing required env vars. Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY')
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
  console.error('   SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✓' : '✗')
  console.error('   OPENAI_API_KEY:', OPENAI_API_KEY ? '✓' : '✗')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const DOCS_DIR = path.resolve(process.cwd(), 'syndicate-docs')

// ── Types ─────────────────────────────────────────────────────────────────────
interface DocFrontMatter {
  coach: string
  title: string
  author?: string
  min_tier?: string
  tags?: string[]
  syndicate_role?: string
  section_path?: string
  pillar?: string
}

interface Chunk {
  coach_name: string
  source_title: string
  source_author: string
  content_chunk: string
  min_tier: string
  tags: string[]
  syndicate_role: string | null
  section_path: string | null
  pillar: string | null
}

// ── Front-matter parser ───────────────────────────────────────────────────────
function parseFrontMatter(content: string): { meta: DocFrontMatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
  if (!fmMatch) return { meta: { coach: 'UNKNOWN', title: 'Unknown' }, body: content }

  const yamlLines = fmMatch[1].split('\n')
  const meta: Record<string, unknown> = {}

  for (const line of yamlLines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let val = line.slice(colonIdx + 1).trim()

    // Handle arrays like [a, b, c] or inline
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
    } else {
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      meta[key] = val
    }
  }

  return { meta: meta as unknown as DocFrontMatter, body: fmMatch[2] }
}

// ── Section chunker ───────────────────────────────────────────────────────────
function chunkByHeadings(body: string, meta: DocFrontMatter): Chunk[] {
  const coach = (meta.coach ?? 'UNKNOWN').toUpperCase()
  const chunks: Chunk[] = []

  // Split on H2 (##) or H3 (###) headings
  const sections = body.split(/\n(?=#{2,3}\s)/)

  for (const section of sections) {
    const trimmed = section.trim()
    if (!trimmed || trimmed.length < 100) continue // skip tiny fragments

    // Extract section heading for section_path
    const headingMatch = trimmed.match(/^(#{2,3})\s+(.+)/)
    const sectionPath = headingMatch ? headingMatch[2].trim() : null

    // If section is very long (>1200 chars), split into sub-chunks
    const subChunks = splitLongSection(trimmed, 1000, 150)

    for (const sub of subChunks) {
      if (sub.trim().length < 80) continue
      chunks.push({
        coach_name:    coach,
        source_title:  meta.title,
        source_author: meta.author ?? 'The Syndicate',
        content_chunk: sub.trim(),
        min_tier:      meta.min_tier ?? 'starter',
        tags:          (meta.tags ?? []) as string[],
        syndicate_role: meta.syndicate_role ?? null,
        section_path:  sectionPath,
        pillar:        meta.pillar ?? null,
      })
    }
  }

  return chunks
}

function splitLongSection(text: string, maxLen: number, overlap: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      // Carry last `overlap` chars as context into next chunk
      const tail = current.length > overlap ? current.slice(-overlap) : current
      current = tail + '\n\n' + para
    } else {
      current = current ? current + '\n\n' + para : para
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks
}

// ── OpenAI embedding ──────────────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.replace(/\n/g, ' ').slice(0, 8000), // safe token limit
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI embedding failed: ${res.status} ${err}`)
  }

  const data = await res.json() as { data: { embedding: number[] }[] }
  return data.data[0].embedding
}

// ── Supabase insert ───────────────────────────────────────────────────────────
async function insertChunk(chunk: Chunk, embedding: number[]): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/syndicate_knowledge`

  const payload = {
    coach_name:     chunk.coach_name,
    source_title:   chunk.source_title,
    source_author:  chunk.source_author,
    content_chunk:  chunk.content_chunk,
    embedding,
    min_tier:       chunk.min_tier,
    tags:           chunk.tags,
    syndicate_role: chunk.syndicate_role,
    section_path:   chunk.section_path,
    pillar:         chunk.pillar,
    is_active:      true,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey':          SERVICE_ROLE_KEY,
      'Authorization':   `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':    'application/json',
      'Prefer':          'return=minimal',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase insert failed: ${res.status} ${err}`)
  }
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧠 Syndicate Knowledge Seeder ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}`)
  console.log(`   Supabase: ${SUPABASE_URL}`)
  console.log(`   Docs dir: ${DOCS_DIR}\n`)

  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.md')).sort()
  console.log(`📄 Found ${files.length} docs: ${files.join(', ')}\n`)

  let totalChunks = 0
  let totalInserted = 0

  for (const file of files) {
    const filePath = path.join(DOCS_DIR, file)
    const content  = fs.readFileSync(filePath, 'utf8')
    const { meta, body } = parseFrontMatter(content)
    const chunks = chunkByHeadings(body, meta)

    console.log(`📖 ${file}`)
    console.log(`   Coach: ${meta.coach} | Title: ${meta.title}`)
    console.log(`   Chunks: ${chunks.length}`)

    if (DRY_RUN) {
      chunks.forEach((c, i) => {
        console.log(`   [${i+1}] ${c.section_path ?? '(intro)'} — ${c.content_chunk.length} chars`)
      })
      console.log()
      totalChunks += chunks.length
      continue
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      process.stdout.write(`   Embedding chunk ${i + 1}/${chunks.length}: ${(chunk.section_path ?? 'intro').slice(0, 40)}...`)

      try {
        const embedding = await embed(chunk.content_chunk)
        await insertChunk(chunk, embedding)
        totalInserted++
        process.stdout.write(' ✓\n')
      } catch (err) {
        process.stdout.write(' ✗\n')
        console.error(`   Error: ${err instanceof Error ? err.message : String(err)}`)
      }

      // Rate limit: ~50 requests/min for OpenAI embeddings free tier → 1.2s spacing
      if (i < chunks.length - 1) await sleep(1200)
    }

    totalChunks += chunks.length
    console.log()
  }

  console.log(`\n✅ Done!`)
  console.log(`   Total chunks processed: ${totalChunks}`)
  if (!DRY_RUN) console.log(`   Successfully inserted: ${totalInserted}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
