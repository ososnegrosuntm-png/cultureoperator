#!/usr/bin/env tsx
/**
 * test-generate.ts
 * Tests the /api/syndicate/generate endpoint against the live deployment.
 * Runs one test per coach to confirm RAG retrieval is working.
 *
 * Usage:
 *   npx tsx scripts/test-generate.ts [--local] [--coach ATLAS]
 *   --local  → hit http://localhost:3000 instead of production
 *   --coach  → test only a specific coach (default: all 6)
 */

import fs from 'fs'
import path from 'path'

// Load env
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

const env  = loadEnv(path.resolve(process.cwd(), '.env.local'))
const BASE = process.argv.includes('--local') ? 'http://localhost:3000' : 'https://www.cultureoperator.com'

const onlyCoach = (() => {
  const idx = process.argv.indexOf('--coach')
  return idx !== -1 ? process.argv[idx + 1]?.toUpperCase() : null
})()

// Test cases — one representative scenario per coach
const testCases = [
  {
    coach: 'ATLAS',
    label: 'Hard intensity member, 14-day streak',
    body: {
      coachName: 'ATLAS',
      memberName: 'Marcus Johnson',
      metrics: {
        daysSinceLast: 0,
        checkInsThisMonth: 15,
        checkInsLast7Days: 5,
        atlasIntensity: 'hard',
        streak: 14,
        disciplineScore: 88,
        nutritionScore: 72,
        recoveryScore: 65,
        overtrained: false,
        deloadNeeded: false,
      },
    },
  },
  {
    coach: 'IRON',
    label: 'Low discipline score, broken streak',
    body: {
      coachName: 'IRON',
      memberName: 'Sarah Chen',
      metrics: {
        daysSinceLast: 5,
        checkInsThisMonth: 3,
        checkInsLast7Days: 0,
        atlasIntensity: 'easy',
        streak: 0,
        disciplineScore: 22,
        nutritionScore: 45,
        recoveryScore: 70,
        overtrained: false,
        deloadNeeded: false,
      },
    },
  },
  {
    coach: 'FORGE',
    label: 'Low nutrition compliance, moderate training',
    body: {
      coachName: 'FORGE',
      memberName: 'David Torres',
      metrics: {
        daysSinceLast: 1,
        checkInsThisMonth: 8,
        checkInsLast7Days: 2,
        atlasIntensity: 'moderate',
        streak: 3,
        disciplineScore: 55,
        nutritionScore: 28,
        weeklyNutritionCompliance: 2,
        recoveryScore: 60,
        overtrained: false,
        deloadNeeded: false,
      },
    },
  },
  {
    coach: 'HAVEN',
    label: 'Overtrained member, deload needed',
    body: {
      coachName: 'HAVEN',
      memberName: 'Alex Rivera',
      metrics: {
        daysSinceLast: 0,
        checkInsThisMonth: 18,
        checkInsLast7Days: 6,
        atlasIntensity: 'hard',
        streak: 18,
        disciplineScore: 95,
        nutritionScore: 80,
        recoveryScore: 32,
        overtrained: true,
        deloadNeeded: true,
      },
    },
  },
  {
    coach: 'APEX',
    label: 'Gym with churn risk and leads',
    body: {
      coachName: 'APEX',
      memberName: 'Owner',
      metrics: {
        totalMembers: 87,
        activeThisMonth: 54,
        estimatedMRR: 12963,
        mrrGrowth: -450,
        churnCount: 7,
        unconvertedLeads: 12,
      },
    },
  },
  {
    coach: 'COMPASS',
    label: 'All-around moderate member, full synthesis',
    body: {
      coachName: 'COMPASS',
      memberName: 'Jordan Williams',
      metrics: {
        daysSinceLast: 2,
        checkInsThisMonth: 9,
        checkInsLast7Days: 2,
        atlasIntensity: 'moderate',
        streak: 4,
        disciplineScore: 61,
        nutritionScore: 58,
        weeklyNutritionCompliance: 4,
        recoveryScore: 67,
        overtrained: false,
        deloadNeeded: false,
        totalMembers: 87,
        activeThisMonth: 54,
        estimatedMRR: 12963,
        mrrGrowth: 320,
        unconvertedLeads: 8,
        churnCount: 4,
      },
    },
  },
]

async function runTest(tc: typeof testCases[number]) {
  const url = `${BASE}/api/syndicate/generate`
  const start = Date.now()

  try {
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(tc.body),
    })

    const elapsed = Date.now() - start
    const data = await res.json() as {
      success?: boolean
      message?: string
      coach?: string
      hasKnowledgeContext?: boolean
      error?: string
    }

    if (!res.ok || !data.message) {
      console.log(`  ❌ ${tc.coach} — HTTP ${res.status}: ${data.error ?? 'no message'}`)
      return false
    }

    console.log(`  ✅ ${tc.coach} (${elapsed}ms) | RAG context: ${data.hasKnowledgeContext ? 'YES ✦' : 'no'}`)
    console.log(`     "${data.message.slice(0, 200)}${data.message.length > 200 ? '…' : ''}"`)
    return true

  } catch (err) {
    const elapsed = Date.now() - start
    console.log(`  ❌ ${tc.coach} (${elapsed}ms) — ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

async function main() {
  const cases = onlyCoach ? testCases.filter(t => t.coach === onlyCoach) : testCases

  console.log(`\n🔬 Syndicate RAG End-to-End Test`)
  console.log(`   Target: ${BASE}`)
  console.log(`   Coaches: ${cases.map(t => t.coach).join(', ')}\n`)

  let passed = 0
  for (const tc of cases) {
    console.log(`▸ ${tc.coach} — ${tc.label}`)
    const ok = await runTest(tc)
    if (ok) passed++
    console.log()
    if (tc !== cases[cases.length - 1]) await new Promise(r => setTimeout(r, 2000))
  }

  console.log(`\n${passed === cases.length ? '✅' : '⚠️'} ${passed}/${cases.length} coaches passed`)
  process.exit(passed === cases.length ? 0 : 1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
