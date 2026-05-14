#!/usr/bin/env tsx
/**
 * import-streamfit-members.ts
 *
 * One-time import of StreamFit CSV members into Osos Negros gym.
 * For each row:
 *   1. supabase.auth.admin.createUser()  → auth.users
 *   2. INSERT INTO profiles
 *   3. INSERT INTO members
 *
 * Usage:
 *   npx tsx scripts/import-streamfit-members.ts [--dry-run]
 */

import fs   from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// ── Env loader ────────────────────────────────────────────────────────────────
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

const SUPABASE_URL      = env.NEXT_PUBLIC_SUPABASE_URL   || process.env.NEXT_PUBLIC_SUPABASE_URL   || ''
const SERVICE_ROLE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY  || process.env.SUPABASE_SERVICE_ROLE_KEY  || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const GYM_ID      = '6d52ca68-4f58-436c-a8f3-66933830e2e9'
const CSV_PATH    = path.resolve(process.env.HOME!, 'Downloads/214-members.csv')
const DRY_RUN     = process.argv.includes('--dry-run')
const IMPORT_DATE = 'May 14 2026'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── CSV parser (no external dep) ──────────────────────────────────────────────
function parseCSV(filePath: string): Record<string, string>[] {
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    // Handle quoted fields containing commas
    const fields: string[] = []
    let inQuote = false
    let current = ''
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue }
      if (ch === ',' && !inQuote) { fields.push(current.trim()); current = ''; continue }
      current += ch
    }
    fields.push(current.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (fields[i] ?? '').trim() })
    return row
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fullName(row: Record<string, string>): string | null {
  if (row.name) return row.name
  const parts = [row.first_name, row.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

function parsePhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return digits.length >= 7 ? `+${digits}` : null
}

function parseBirthday(raw: string): string | null {
  if (!raw) return null
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

// ── Counters ──────────────────────────────────────────────────────────────────
const stats = {
  authCreated:     0,
  profilesInserted: 0,
  membersLinked:   0,
  skipped: [] as { email: string; reason: string }[],
  errors:  [] as { email: string; step: string; message: string }[],
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📋 StreamFit Member Import ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}`)
  console.log(`   CSV: ${CSV_PATH}`)
  console.log(`   Gym: ${GYM_ID}\n`)

  // ── 1. Parse CSV ────────────────────────────────────────────────────────────
  const raw = parseCSV(CSV_PATH)
  console.log(`   Parsed ${raw.length} rows from CSV\n`)

  // ── 2. Dedupe by email (case-insensitive, keep first occurrence) ────────────
  const seen = new Set<string>()
  const rows: Record<string, string>[] = []

  for (const row of raw) {
    const email = row.email?.trim().toLowerCase()

    if (!email) {
      stats.skipped.push({ email: '(empty)', reason: 'no email — phone-only row, skipping' })
      continue
    }

    if (seen.has(email)) {
      stats.skipped.push({ email, reason: 'duplicate email — keeping first occurrence' })
      continue
    }

    seen.add(email)
    rows.push(row)
  }

  console.log(`   Deduped: ${rows.length} unique rows with email`)
  console.log(`   Skipped pre-import: ${stats.skipped.length}\n`)

  // ── 3. Find-or-create the import membership plan ────────────────────────────
  let membershipId: string

  if (!DRY_RUN) {
    // Check if it already exists
    const { data: existing } = await supabase
      .from('memberships')
      .select('id')
      .eq('gym_id', GYM_ID)
      .eq('name', 'StreamFit Imported (pending plan assignment)')
      .maybeSingle()

    if (existing?.id) {
      membershipId = existing.id
      console.log(`   ✓ Found existing import plan: ${membershipId}`)
    } else {
      const { data: created, error: planErr } = await supabase
        .from('memberships')
        .insert({
          gym_id:         GYM_ID,
          name:           'StreamFit Imported (pending plan assignment)',
          description:    `Auto-created for CSV import on ${IMPORT_DATE}. Reassign members to real plans manually.`,
          price:          0,
          billing_period: 'monthly',
          features:       [],
          is_active:      false,
        })
        .select('id')
        .single()

      if (planErr || !created?.id) {
        console.error('❌ Failed to create import membership plan:', planErr?.message)
        process.exit(1)
      }
      membershipId = created.id
      console.log(`   ✓ Created import plan: ${membershipId}`)
    }
  } else {
    membershipId = 'dry-run-membership-id'
    console.log(`   [DRY RUN] Would find-or-create membership plan`)
  }

  console.log()

  // ── 4. Process each row ─────────────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const row     = rows[i]
    const email   = row.email.trim()
    const phone   = parsePhone(row.phone)
    const name    = fullName(row)
    const bday    = parseBirthday(row.birthday)
    const display = `[${i + 1}/${rows.length}] ${email}`

    if (DRY_RUN) {
      console.log(`  ${display}`)
      console.log(`    name=${name ?? 'null'} phone=${phone ?? 'null'} birthday=${bday ?? 'null'}`)
      stats.authCreated++
      stats.profilesInserted++
      stats.membersLinked++
      continue
    }

    // ── Step 1: Create auth user ──────────────────────────────────────────────
    let userId: string

    try {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        phone:                phone ?? undefined,
        email_confirm:        true,
        user_metadata: {
          full_name: name ?? undefined,
        },
      })

      if (authErr) {
        // If user already exists, try to look them up
        if (authErr.message?.toLowerCase().includes('already') ||
            authErr.message?.toLowerCase().includes('duplicate') ||
            authErr.code === '422') {
          // Try listing users to find the existing one
          const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
          const existing = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
          if (existing) {
            userId = existing.id
            console.log(`  ⚠ ${display} — auth user already exists, using ${userId}`)
          } else {
            throw authErr
          }
        } else {
          throw authErr
        }
      } else {
        if (!authData?.user?.id) throw new Error('No user ID returned from createUser')
        userId = authData.user.id
      }

      stats.authCreated++

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${display} — AUTH failed: ${msg}`)
      stats.errors.push({ email, step: 'auth.createUser', message: msg })
      continue
    }

    // ── Step 2: Insert profile ────────────────────────────────────────────────
    try {
      const { error: profErr } = await supabase
        .from('profiles')
        .upsert(
          {
            id:         userId,
            email,
            phone:      phone ?? null,
            full_name:  name ?? null,
            role:       'member',
            gym_id:     GYM_ID,
            birthday:   bday ?? null,
            instagram:  null,
            avatar_url: null,
          },
          { onConflict: 'id', ignoreDuplicates: false }
        )

      if (profErr) throw new Error(profErr.message)
      stats.profilesInserted++

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${display} — PROFILE failed: ${msg}`)
      stats.errors.push({ email, step: 'profiles.upsert', message: msg })
      continue
    }

    // ── Step 3: Insert member ─────────────────────────────────────────────────
    try {
      const { error: memErr } = await supabase
        .from('members')
        .upsert(
          {
            gym_id:        GYM_ID,
            profile_id:    userId,
            membership_id: membershipId,
            status:        'active_pending_verify',
            joined_at:     new Date().toISOString(),
            expires_at:    null,
          },
          { onConflict: 'gym_id,profile_id', ignoreDuplicates: false }
        )

      if (memErr) throw new Error(memErr.message)
      stats.membersLinked++

      process.stdout.write(`  ✓ ${display}\n`)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${display} — MEMBER failed: ${msg}`)
      stats.errors.push({ email, step: 'members.upsert', message: msg })
    }

    // Brief pause every 10 rows to avoid rate-limiting auth admin API
    if ((i + 1) % 10 === 0) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // ── 5. Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60))
  console.log('IMPORT COMPLETE')
  console.log('─'.repeat(60))
  console.log(`  ✓ Auth users created/resolved : ${stats.authCreated}`)
  console.log(`  ✓ Profiles inserted/upserted  : ${stats.profilesInserted}`)
  console.log(`  ✓ Members linked              : ${stats.membersLinked}`)
  console.log(`  ✗ Errors                      : ${stats.errors.length}`)
  console.log(`  — Skipped (pre-import)        : ${stats.skipped.length}`)
  console.log()

  if (stats.skipped.length > 0) {
    console.log('Skipped rows:')
    stats.skipped.forEach(s => console.log(`  • ${s.email} — ${s.reason}`))
    console.log()
  }

  if (stats.errors.length > 0) {
    console.log('Errors:')
    stats.errors.forEach(e => console.log(`  • [${e.step}] ${e.email} — ${e.message}`))
    console.log()
  }

  const total = raw.length
  const valid = rows.length
  const imported = stats.membersLinked
  const skipTotal = total - imported - stats.errors.length
  console.log(`  Total CSV rows    : ${total}`)
  console.log(`  Valid (w/ email)  : ${valid}`)
  console.log(`  Successfully imported: ${imported}`)
  console.log(`  Skipped/errored   : ${skipTotal + stats.errors.length}`)

  if (!DRY_RUN) {
    console.log('\nVerification query:')
    console.log(`  SELECT COUNT(*) FROM members WHERE gym_id = '${GYM_ID}' AND status = 'active_pending_verify';`)
  }
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
