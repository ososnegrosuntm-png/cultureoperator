#!/usr/bin/env node
// Backfills phone, email, birthday from CSV into profiles table.
// Run once: node backfill_phones.js

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')
const os   = require('os')

const SUPABASE_URL     = 'https://htqwoxkcgkdzeitdmxlx.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CSV_PATH         = path.join(__dirname, '214-members.csv')

if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required')
  process.exit(1)
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function splitCSVLine(line) {
  const result = []; let current = ''; let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (inQ && line[i+1] === '"') { current += '"'; i++ } else inQ = !inQ }
    else if (ch === ',' && !inQ) { result.push(current); current = '' }
    else current += ch
  }
  result.push(current)
  return result
}

function parseCSV(filePath) {
  const raw     = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '')
  const lines   = raw.split('\n').filter(l => l.trim())
  const headers = splitCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (vals[i] || '').trim()]))
  }).filter(r => Object.values(r).some(v => v))
}

// ── E.164 normaliser ──────────────────────────────────────────────────────────

function toE164(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const rows = parseCSV(CSV_PATH)
  console.log(`Parsed ${rows.length} rows from CSV\n`)

  let updated = 0, skipped = 0, failed = 0

  for (const row of rows) {
    const email   = row.email?.trim() || `noemail+${row.id}@import.local`
    const phone   = toE164(row.phone)
    const birthday = row.birthday ? row.birthday.trim() || null : null

    if (!phone) { skipped++; continue }

    // Find profile by email (auth user email → profile id)
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!authUser) { console.log(`  SKIP (no auth user): ${email}`); skipped++; continue }

    const { error } = await supabase
      .from('profiles')
      .update({ phone, email: row.email?.trim() || null, birthday: birthday || null })
      .eq('id', authUser.id)

    if (error) {
      console.log(`  FAIL ${email}: ${error.message}`)
      failed++
    } else {
      updated++
      if (updated % 20 === 0) console.log(`  ${updated} updated…`)
    }
  }

  console.log(`\n── Backfill complete ────────────`)
  console.log(`  Updated : ${updated}`)
  console.log(`  Skipped : ${skipped}`)
  console.log(`  Failed  : ${failed}`)
}

main().catch(err => { console.error(err); process.exit(1) })
