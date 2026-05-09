'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Sprint constants ──────────────────────────────────────────────────────────
const SPRINT_START   = new Date('2026-05-07T00:00:00')
const SPRINT_DAYS    = 24
const SPRINT_END_MS  = SPRINT_START.getTime() + (SPRINT_DAYS - 1) * 864e5

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function roundOf(dateStr: string): number {
  const diff = new Date(dateStr + 'T00:00:00').getTime() - SPRINT_START.getTime()
  return Math.max(1, Math.min(SPRINT_DAYS, Math.floor(diff / 864e5) + 1))
}
function inSprint(dateStr: string): boolean {
  const t = new Date(dateStr + 'T00:00:00').getTime()
  return t >= SPRINT_START.getTime() && t <= SPRINT_END_MS
}
function sprintDayOf(dateStr: string): number {
  return roundOf(dateStr)
}

// ── Lane config ───────────────────────────────────────────────────────────────
const LANES = [
  { num: '01', tag: 'PIPELINE',           sub: 'Outbound activity' },
  { num: '02', tag: 'CULTUREOPERATOR',    sub: 'Ship one feature' },
  { num: '03', tag: 'BEAR MASTER',        sub: 'PM contact or scope' },
  { num: '04', tag: 'GYM · OSOS NEGROS', sub: 'Member or social' },
  { num: '05', tag: 'LEADS / MISC',       sub: 'KW lead or personal' },
]

const BRIEF = 'The standard is the standard. Five lanes. One day. Win or lose — you decide at sundown.'

// ── Types ─────────────────────────────────────────────────────────────────────
type Mode = 'strict' | 'streak' | 'lane'

type DayRecord = {
  day_date: string
  lane_1_task: string; lane_2_task: string; lane_3_task: string
  lane_4_task: string; lane_5_task: string
  lane_1_done: boolean; lane_2_done: boolean; lane_3_done: boolean
  lane_4_done: boolean; lane_5_done: boolean
}

type Props = { userId: string; gymId: string | null }

const EMPTY: DayRecord = {
  day_date: today(),
  lane_1_task: '', lane_2_task: '', lane_3_task: '', lane_4_task: '', lane_5_task: '',
  lane_1_done: false, lane_2_done: false, lane_3_done: false, lane_4_done: false, lane_5_done: false,
}

function taskKey(i: number): keyof DayRecord {
  return `lane_${i + 1}_task` as keyof DayRecord
}
function doneKey(i: number): keyof DayRecord {
  return `lane_${i + 1}_done` as keyof DayRecord
}
function scoreOf(r: DayRecord): number {
  return [r.lane_1_done, r.lane_2_done, r.lane_3_done, r.lane_4_done, r.lane_5_done].filter(Boolean).length
}
function wonDay(r: DayRecord): boolean { return scoreOf(r) === 5 }

// ── Main component ────────────────────────────────────────────────────────────
export function PowerListPanel({ userId, gymId }: Props) {
  const supabase = createClient()

  const [selDate,    setSelDate]    = useState(today())
  const [edit,       setEdit]       = useState<DayRecord>({ ...EMPTY, day_date: today() })
  const [sprintDays, setSprintDays] = useState<DayRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [mode,       setMode]       = useState<Mode>('strict')

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load all sprint records once ─────────────────────────────────────────
  const loadSprint = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('power_list_days')
      .select('day_date,lane_1_task,lane_2_task,lane_3_task,lane_4_task,lane_5_task,lane_1_done,lane_2_done,lane_3_done,lane_4_done,lane_5_done')
      .eq('user_id', userId)
      .gte('day_date', toDateStr(SPRINT_START))
      .lte('day_date', toDateStr(new Date(SPRINT_END_MS)))
    setSprintDays((data ?? []) as DayRecord[])
  }, [supabase, userId])

  // ── Load a specific day ───────────────────────────────────────────────────
  const loadDay = useCallback(async (dateStr: string) => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('power_list_days')
      .select('*')
      .eq('user_id', userId)
      .eq('day_date', dateStr)
      .maybeSingle()
    setEdit(data ? (data as DayRecord) : { ...EMPTY, day_date: dateStr })
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    loadSprint()
  }, [loadSprint])

  useEffect(() => {
    loadDay(selDate)
  }, [selDate, loadDay])

  // ── Upsert to DB ──────────────────────────────────────────────────────────
  const saveDay = useCallback(async (record: DayRecord) => {
    setSaving(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('power_list_days')
      .upsert(
        { ...record, user_id: userId, gym_id: gymId, scoring_mode: mode },
        { onConflict: 'user_id,day_date' }
      )
    setSaving(false)
    // refresh sprint cache
    setSprintDays(prev => {
      const idx = prev.findIndex(d => d.day_date === record.day_date)
      if (idx >= 0) { const next = [...prev]; next[idx] = record; return next }
      return [...prev, record]
    })
  }, [supabase, userId, gymId, mode])

  // ── Update task text (debounced save) ─────────────────────────────────────
  function updateTask(i: number, value: string) {
    const next = { ...edit, [taskKey(i)]: value }
    setEdit(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDay(next), 600)
  }

  // ── Toggle done (immediate save) ─────────────────────────────────────────
  function toggleDone(i: number) {
    const next = { ...edit, [doneKey(i)]: !edit[doneKey(i)] }
    setEdit(next)
    saveDay(next)
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function nav(n: number) {
    const next = addDays(selDate, n)
    if (inSprint(next)) setSelDate(next)
  }

  const todayStr    = today()
  const canPrev     = inSprint(addDays(selDate, -1))
  const canNext     = inSprint(addDays(selDate, 1))
  const isToday     = selDate === todayStr
  const score       = scoreOf(edit)
  const roundNum    = sprintDayOf(selDate)
  const sprintDay   = roundNum
  const remaining   = SPRINT_DAYS - Math.min(SPRINT_DAYS, Math.floor((new Date(todayStr + 'T00:00:00').getTime() - SPRINT_START.getTime()) / 864e5) + 1)
  const wins        = sprintDays.filter(wonDay).length
  const winRate     = sprintDays.length > 0 ? Math.round((wins / sprintDays.length) * 100) : 0

  // Today's score (for top-right badge) — from sprintDays or current edit if today
  const todayRecord = sprintDays.find(d => d.day_date === todayStr)
  const todayScore  = isToday ? score : (todayRecord ? scoreOf(todayRecord) : 0)

  // ── Streak ────────────────────────────────────────────────────────────────
  function calcStreak(): number {
    let s = 0
    let cur = todayStr
    // count back from yesterday if today not won, else include today
    const todayRec = sprintDays.find(d => d.day_date === cur) ?? (isToday ? edit : null)
    if (!todayRec || !wonDay(todayRec)) cur = addDays(cur, -1)
    while (true) {
      const rec = sprintDays.find(d => d.day_date === cur) ?? (cur === selDate ? edit : null)
      if (!rec || !wonDay(rec)) break
      s++
      cur = addDays(cur, -1)
      if (!inSprint(cur)) break
    }
    return s
  }

  // ── Lane stats (for LANE mode) ────────────────────────────────────────────
  const laneStats = LANES.map((_, i) => {
    const total = sprintDays.length
    const done  = sprintDays.filter(d => d[doneKey(i)] as boolean).length
    return { pct: total > 0 ? Math.round((done / total) * 100) : 0, done, total }
  })
  const weakestLane = laneStats.indexOf(laneStats.reduce((a, b) => (a.pct <= b.pct ? a : b)))

  const streak = calcStreak()

  // ── Sprint timeline (for STREAK mode) ────────────────────────────────────
  const timelineDays: { dateStr: string; won: boolean | null; isToday: boolean }[] = []
  for (let i = 0; i < SPRINT_DAYS; i++) {
    const d   = toDateStr(new Date(SPRINT_START.getTime() + i * 864e5))
    const rec = sprintDays.find(r => r.day_date === d) ?? (d === selDate ? edit : null)
    const future = new Date(d + 'T00:00:00') > new Date(todayStr + 'T00:00:00')
    timelineDays.push({
      dateStr: d,
      won: future ? null : rec ? wonDay(rec) : false,
      isToday: d === todayStr,
    })
  }

  // ── Display date label ────────────────────────────────────────────────────
  const displayDate = new Date(selDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-bone">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-ink border-b border-bone/8 px-10 py-7 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase text-gold/60 font-medium">
            Round {roundNum} of {SPRINT_DAYS} &nbsp;·&nbsp; {displayDate}
          </p>
          <h1 className="font-serif text-3xl font-bold text-bone mt-1">
            Your Syndicate is <span className="text-gold">working.</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 shrink-0 pt-1">
          {/* Scoring mode toggle */}
          <div className="flex border border-bone/15">
            {(['strict', 'streak', 'lane'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`text-[9px] tracking-widest uppercase font-bold px-3 py-1.5 transition-colors ${
                  mode === m ? 'bg-gold text-ink' : 'text-bone/40 hover:text-bone/70'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {/* Today's score badge */}
          <div className="text-center">
            <p className="font-serif text-3xl font-bold text-gold leading-none">{todayScore}<span className="text-base font-sans font-normal text-bone/30">/5</span></p>
            <p className="text-[9px] tracking-widest uppercase text-bone/30 mt-0.5">Today</p>
          </div>
        </div>
      </div>

      <div className="px-10 py-8 space-y-6 max-w-4xl mx-auto">

        {/* ── Daily Brief ───────────────────────────────────────────────────── */}
        <div className="bg-ink px-8 py-7 border-l-2 border-gold">
          <p className="text-[10px] tracking-widest uppercase text-gold/50 font-medium mb-3">Daily Brief</p>
          <p className="font-serif text-xl text-gold leading-relaxed italic">
            &ldquo;{BRIEF}&rdquo;
          </p>
        </div>

        {/* ── Score hero ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-8">
          <div className="bg-ink flex flex-col items-center justify-center w-28 h-28 shrink-0 border border-bone/10">
            <span className={`font-serif text-6xl font-bold leading-none ${score === 5 ? 'text-gold' : 'text-bone'}`}>
              {loading ? '—' : score}
            </span>
            <span className="text-[10px] tracking-widest uppercase text-bone/30 mt-1">of 5</span>
          </div>
          <div>
            <p className="text-sm text-ink font-semibold">
              {score === 5 ? '✓ Day won.' : `${score} of 5 lanes complete`}
            </p>
            {streak > 0 && (
              <p className="text-xs text-ink-muted mt-1">
                <span className="text-gold font-semibold">{streak}</span>-day win streak
              </p>
            )}
            {streak === 0 && (
              <p className="text-xs text-ink-muted mt-1">Win all 5 lanes to extend your streak.</p>
            )}
          </div>
        </div>

        {/* ── Mode-specific panel ───────────────────────────────────────────── */}
        {mode === 'streak' && (
          <div className="border border-bone-deeper bg-white/40 p-6">
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium mb-4">Sprint Timeline — Win / Loss</p>
            <div className="flex flex-wrap gap-1.5">
              {timelineDays.map(({ dateStr, won, isToday }) => (
                <button
                  key={dateStr}
                  onClick={() => inSprint(dateStr) && setSelDate(dateStr)}
                  title={dateStr}
                  className={`w-7 h-7 text-[9px] font-bold transition-colors border ${
                    isToday
                      ? 'border-gold'
                      : 'border-transparent'
                  } ${
                    won === true  ? 'bg-gold text-ink' :
                    won === false ? 'bg-bone-deeper text-ink-muted' :
                    'bg-bone-dark text-ink-muted/30'
                  }`}
                >
                  {sprintDayOf(dateStr)}
                </button>
              ))}
            </div>
            <div className="flex gap-5 mt-4">
              <span className="text-xs text-ink-muted flex items-center gap-1.5">
                <span className="w-3 h-3 bg-gold inline-block" /> Win
              </span>
              <span className="text-xs text-ink-muted flex items-center gap-1.5">
                <span className="w-3 h-3 bg-bone-deeper inline-block" /> Loss
              </span>
              <span className="text-xs text-ink-muted flex items-center gap-1.5">
                <span className="w-3 h-3 bg-bone-dark inline-block" /> Upcoming
              </span>
            </div>
          </div>
        )}

        {mode === 'lane' && (
          <div className="border border-bone-deeper bg-white/40 p-6">
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium mb-4">Lane Completion — Sprint to Date</p>
            <div className="space-y-3">
              {LANES.map((lane, i) => {
                const stat    = laneStats[i]
                const lagging = i === weakestLane
                return (
                  <div key={i} className="flex items-center gap-4">
                    <span className={`text-[10px] font-bold tracking-widest w-36 shrink-0 uppercase ${lagging ? 'text-[#b45454]' : 'text-ink-muted'}`}>
                      {lane.tag}
                    </span>
                    <div className="flex-1 h-1.5 bg-bone-deeper">
                      <div
                        className={`h-full transition-all ${lagging ? 'bg-[#b45454]' : 'bg-gold'}`}
                        style={{ width: `${stat.pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-ink-muted w-12 text-right font-mono shrink-0">{stat.pct}%</span>
                    {lagging && <span className="text-[9px] text-[#b45454] font-bold uppercase tracking-widest">Lagging</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Five Lanes ────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-4 mb-3">
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium">Five Lanes</p>
            <div className="h-px flex-1 bg-bone-deeper" />
            {saving && <p className="text-[9px] tracking-widest uppercase text-ink-muted/50">Saving&hellip;</p>}
          </div>

          <div className="divide-y divide-bone-deeper border border-bone-deeper">
            {LANES.map((lane, i) => {
              const isDone = edit[doneKey(i)] as boolean
              const taskVal = edit[taskKey(i)] as string
              return (
                <div
                  key={i}
                  className={`flex items-center gap-0 group transition-colors ${
                    isDone ? 'bg-gold/5' : 'bg-white/50 hover:bg-bone-dark'
                  }`}
                >
                  {/* Left: won indicator */}
                  <div className={`w-1 self-stretch shrink-0 ${isDone ? 'bg-gold' : 'bg-transparent'}`} />

                  {/* Lane number */}
                  <div className={`w-12 h-16 flex items-center justify-center shrink-0 border-r ${
                    isDone ? 'border-gold/20 bg-gold/10' : 'border-bone-deeper'
                  }`}>
                    <span className={`font-serif text-lg font-bold ${isDone ? 'text-gold' : 'text-ink-muted/40'}`}>
                      {lane.num}
                    </span>
                  </div>

                  {/* Tag */}
                  <div className="w-44 px-4 shrink-0">
                    <p className={`text-[10px] font-bold tracking-widest uppercase leading-tight ${
                      isDone ? 'text-gold' : 'text-ink'
                    }`}>
                      {lane.tag}
                    </p>
                    <p className="text-[10px] text-ink-muted/60 mt-0.5">{lane.sub}</p>
                  </div>

                  {/* Task input */}
                  <div className="flex-1 px-4">
                    <input
                      type="text"
                      value={taskVal}
                      onChange={e => updateTask(i, e.target.value)}
                      placeholder="Add today's task…"
                      className={`w-full bg-transparent text-sm focus:outline-none placeholder:text-ink-muted/30 transition-colors ${
                        isDone
                          ? 'text-ink-muted/50 line-through decoration-gold'
                          : 'text-ink'
                      }`}
                    />
                  </div>

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(i)}
                    className={`w-16 h-16 flex items-center justify-center shrink-0 border-l transition-colors ${
                      isDone
                        ? 'border-gold/20 bg-gold text-ink'
                        : 'border-bone-deeper text-ink-muted/20 hover:text-gold hover:border-gold/40'
                    }`}
                  >
                    {isDone ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1.5" y="1.5" width="11" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Day Navigation ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => nav(-1)}
            disabled={!canPrev}
            className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted border border-bone-deeper px-4 py-2 hover:bg-bone-dark transition-colors disabled:opacity-30"
          >
            ← Prev
          </button>
          <button
            onClick={() => setSelDate(todayStr)}
            className={`text-[10px] tracking-widest uppercase font-semibold px-5 py-2 transition-colors ${
              isToday
                ? 'bg-gold text-ink'
                : 'text-ink-muted border border-bone-deeper hover:bg-bone-dark'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => nav(1)}
            disabled={!canNext}
            className="text-[10px] tracking-widest uppercase font-semibold text-ink-muted border border-bone-deeper px-4 py-2 hover:bg-bone-dark transition-colors disabled:opacity-30"
          >
            Next →
          </button>
        </div>

        {/* ── Bottom stats ──────────────────────────────────────────────────── */}
        <div className="border-t border-bone-deeper pt-5 flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium">Sprint Day</p>
            <p className="font-serif text-2xl font-bold text-ink mt-0.5">
              {sprintDay} <span className="text-sm font-sans font-normal text-ink-muted">of {SPRINT_DAYS}</span>
            </p>
          </div>
          <div className="w-px h-8 bg-bone-deeper" />
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium">Days Remaining</p>
            <p className="font-serif text-2xl font-bold text-ink mt-0.5">
              {Math.max(0, remaining)} <span className="text-sm font-sans font-normal text-ink-muted">days left</span>
            </p>
          </div>
          <div className="w-px h-8 bg-bone-deeper" />
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium">Win Rate</p>
            <p className={`font-serif text-2xl font-bold mt-0.5 ${winRate >= 80 ? 'text-gold' : winRate >= 50 ? 'text-ink' : 'text-ink-muted'}`}>
              {winRate}<span className="text-sm font-sans font-normal text-ink-muted">%</span>
            </p>
          </div>
          <div className="w-px h-8 bg-bone-deeper" />
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ink-muted font-medium">Wins Logged</p>
            <p className="font-serif text-2xl font-bold text-gold mt-0.5">
              {wins} <span className="text-sm font-sans font-normal text-ink-muted">of {sprintDays.length} days</span>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
