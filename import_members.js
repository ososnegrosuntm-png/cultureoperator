#!/usr/bin/env node
// import_members.js
//
// Imports StreamFit members from CSV into Supabase.
//
// BEFORE RUNNING — apply this migration in the Supabase SQL Editor:
//
//   ALTER TABLE members DROP CONSTRAINT members_status_check;
//   ALTER TABLE members ADD CONSTRAINT members_status_check
//     CHECK (status IN ('active', 'inactive', 'suspended', 'lead'));
//
// REQUIRED ENV VARS:
//   SUPABASE_SERVICE_ROLE_KEY  — Settings → API → service_role secret
//   GYM_ID                    — UUID of the gym to attach members to
//
// OPTIONAL ENV VARS:
//   CSV_PATH  — defaults to ~/Downloads/214-members (2).csv
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=xxx GYM_ID=yyy node import_members.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://htqwoxkcgkdzeitdmxlx.supabase.co'

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GYM_ID = process.env.GYM_ID

const CSV_PATH = process.env.CSV_PATH
  || path.join(os.homedir(), 'Downloads', '214-members (2).csv')

// ── Status mapping ────────────────────────────────────────────────────────────

function mapStatus(memberTypes) {
  const t = (memberTypes || '').trim().toLowerCase()
  if (t.includes('membership_active')) return 'active'
  if (t === 'lead') return 'lead'
  return 'inactive'
}

// ── CSV parser (no external deps) ────────────────────────────────────────────

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, '') // strip BOM
  const lines = raw.split('\n').filter(l => l.trim())
  const headers = splitCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] || '').trim()]))
  }).filter(r => Object.values(r).some(v => v)) // skip blank rows
}

function splitCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY is required.')
    console.error('  Find it at: Supabase Dashboard → Settings → API → service_role')
    process.exit(1)
  }
  if (!GYM_ID) {
    console.error('ERROR: GYM_ID is required.')
    console.error('  Find it at: Supabase Dashboard → Table Editor → gyms table')
    process.exit(1)
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`ERROR: CSV not found at: ${CSV_PATH}`)
    console.error('  Set CSV_PATH env var to override the default path.')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const members = parseCSV(CSV_PATH)
  console.log(`Parsed ${members.length} members from CSV.\n`)

  let created = 0, updated = 0, failed = 0

  for (let i = 0; i < members.length; i++) {
    const row = members[i]
    const email = row.email || `noemail+${row.id}@import.local`
    const fullName = row.name || [row.first_name, row.last_name].filter(Boolean).join(' ') || email
    const status = mapStatus(row.member_types)
    const joinedAt = row.joined_date ? new Date(row.joined_date).toISOString() : new Date().toISOString()

    process.stdout.write(`[${i + 1}/${members.length}] ${fullName} (${email}) — `)

    // 1. Create or retrieve auth user
    let userId
    const { data: existing } = await supabase.auth.admin.listUsers()
    const existingUser = existing?.users?.find(u => u.email === email)

    if (existingUser) {
      userId = existingUser.id
      process.stdout.write('auth user exists, ')
    } else {
      const { data: created_user, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      })
      if (createErr) {
        console.log(`SKIP (auth error: ${createErr.message})`)
        failed++
        continue
      }
      userId = created_user.user.id
      process.stdout.write('auth user created, ')
    }

    // 2. Upsert profile
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        role: 'member',
        gym_id: GYM_ID,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (profileErr) {
      console.log(`SKIP (profile error: ${profileErr.message})`)
      failed++
      continue
    }

    // 3. Upsert member record
    const { data: existingMember } = await supabase
      .from('members')
      .select('id')
      .eq('gym_id', GYM_ID)
      .eq('profile_id', userId)
      .maybeSingle()

    const memberPayload = {
      gym_id: GYM_ID,
      profile_id: userId,
      status,
      joined_at: joinedAt,
    }

    let memberErr
    if (existingMember) {
      const { error } = await supabase
        .from('members')
        .update({ status, joined_at: joinedAt })
        .eq('id', existingMember.id)
      memberErr = error
      if (!memberErr) { console.log('updated'); updated++ }
    } else {
      const { error } = await supabase
        .from('members')
        .insert(memberPayload)
      memberErr = error
      if (!memberErr) { console.log('inserted'); created++ }
    }

    if (memberErr) {
      console.log(`FAILED (member error: ${memberErr.message})`)
      if (memberErr.message.includes('members_status_check')) {
        console.log('\n⚠️  STATUS CONSTRAINT VIOLATION — run this in the Supabase SQL Editor first:')
        console.log(`
  ALTER TABLE members DROP CONSTRAINT members_status_check;
  ALTER TABLE members ADD CONSTRAINT members_status_check
    CHECK (status IN ('active', 'inactive', 'suspended', 'lead'));
`)
        process.exit(1)
      }
      failed++
    }
  }

  console.log(`\n── Import complete ──────────────────`)
  console.log(`  Inserted : ${created}`)
  console.log(`  Updated  : ${updated}`)
  console.log(`  Failed   : ${failed}`)
  console.log(`  Total    : ${members.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
