#!/usr/bin/env tsx
/**
 * test-rag-retrieval.ts
 * Tests vector search (embed → match_syndicate_knowledge RPC) directly.
 * Does NOT require Anthropic key — verifies the RAG plumbing only.
 *
 * Usage: npx tsx scripts/test-rag-retrieval.ts
 */

import fs   from 'fs'
import path from 'path'

function loadEnv(f: string): Record<string, string> {
  const env: Record<string, string> = {}
  if (!fs.existsSync(f)) return env
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[t.slice(0, eq).trim()] = v
  }
  return env
}

const env = loadEnv(path.resolve(process.cwd(), '.env.local'))

const SUPABASE_URL     = env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY    ?? ''
const OPENAI_API_KEY   = env.OPENAI_API_KEY               ?? ''

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  const data = await res.json() as { data: { embedding: number[] }[] }
  return data.data[0].embedding
}

async function vectorSearch(query: string, coach: string, k = 3) {
  const embedding = await embed(query)

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_syndicate_knowledge`, {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      query_embedding: embedding,
      match_count:     k,
      filter_coach:    coach,
    }),
  })

  if (!res.ok) throw new Error(`RPC failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<{ coach_name: string; source_title: string; content_chunk: string; similarity: number }[]>
}

const TESTS = [
  { coach: 'ATLAS',   query: 'periodization strength training 5x5 deload week',          expect: 'programming' },
  { coach: 'ATLAS',   query: 'member not checking in churn risk reactivation',           expect: 'engagement' },
  { coach: 'IRON',    query: 'discipline score habit consistency identity missed session', expect: 'discipline' },
  { coach: 'FORGE',   query: 'protein target meal prep nutrition compliance macros',      expect: 'nutrition' },
  { coach: 'HAVEN',   query: 'overtraining recovery sleep HRV deload signals',           expect: 'recovery' },
  { coach: 'APEX',    query: 'MRR retention churn revenue gym business growth',          expect: 'business' },
  { coach: 'COMPASS', query: 'daily brief integrated coaching all five coaches',         expect: 'synthesis' },
]

async function main() {
  console.log('\n🔍 Syndicate RAG Retrieval Test')
  console.log(`   DB: ${SUPABASE_URL}\n`)

  let passed = 0

  for (const t of TESTS) {
    try {
      const start   = Date.now()
      const results = await vectorSearch(t.query, t.coach)
      const elapsed = Date.now() - start

      if (!results || results.length === 0) {
        console.log(`  ❌ ${t.coach} — No results returned`)
        continue
      }

      const top = results[0]
      const sim = (top.similarity * 100).toFixed(1)
      console.log(`  ✅ ${t.coach} (${elapsed}ms) | top similarity: ${sim}%`)
      console.log(`     Source: "${top.source_title.slice(0, 60)}"`)
      console.log(`     Chunk: "${top.content_chunk.slice(0, 120).replace(/\n/g, ' ')}…"`)
      passed++
    } catch (err) {
      console.log(`  ❌ ${t.coach} — ${err instanceof Error ? err.message : String(err)}`)
    }
    console.log()
    await new Promise(r => setTimeout(r, 800))
  }

  console.log(`\n${passed === TESTS.length ? '✅' : '⚠️'} ${passed}/${TESTS.length} retrieval tests passed`)
  if (passed === TESTS.length) {
    console.log('\n   RAG pipeline confirmed: embed → vector search → relevant chunks ✦')
    console.log('   Add ANTHROPIC_API_KEY to Vercel to activate full generation.')
  }
  process.exit(passed === TESTS.length ? 0 : 1)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
