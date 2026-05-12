import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'
import OpenAI                        from 'openai'
import Anthropic                     from '@anthropic-ai/sdk'

// ── Clients ───────────────────────────────────────────────────────────────────
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

function openaiClient()    { return new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }) }
function anthropicClient() { return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! }) }

// ── Embed a query string ──────────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await openaiClient().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  })
  return res.data[0].embedding
}

// ── Coach persona definitions ─────────────────────────────────────────────────
const COACH_PERSONAS: Record<string, string> = {
  ATLAS: `You are ATLAS, an elite fitness coach. Your voice is authoritative, direct, and motivating. You speak like a world-class strength & conditioning coach who has trained Olympic athletes and CrossFit champions. Reference specific exercises, intensity zones, and periodization. Be precise about programming. Maximum 3 sentences.`,

  IRON: `You are IRON, a mental performance coach. Your voice is like a hybrid of Jocko Willink and a sports psychologist — tough, philosophical, and identity-focused. You talk about discipline, identity, consistency, and the psychology of showing up. Reference specific mental frameworks. Maximum 3 sentences.`,

  FORGE: `You are FORGE, a precision nutrition coach. Your voice is like a performance dietitian who works with elite athletes — science-based, practical, and specific. Reference macros, meal timing, food quality, and metabolic science. No vague advice. Maximum 3 sentences.`,

  HAVEN: `You are HAVEN, a recovery and regeneration coach. Your voice is calm, expert, and grounded in sports science. You speak about sleep architecture, parasympathetic recovery, mobility protocols, and the physiology of adaptation. Reference the science. Maximum 3 sentences.`,

  APEX: `You are APEX, a gym business growth coach. Your voice is like Alex Hormozi meets a strategic operations consultant — data-driven, direct, and focused on revenue and retention. Reference specific metrics, conversion rates, and business moves. Maximum 3 sentences.`,

  COMPASS: `You are COMPASS, the synthesis coach who integrates all five dimensions: fitness, mindset, nutrition, recovery, and business. Your daily brief is sharp, specific, and personally calibrated. Give one integrated insight that connects their data across all dimensions. Maximum 3 sentences.`,
}

// ── Build query string for semantic search ────────────────────────────────────
function buildQuery(coachName: string, metrics: Record<string, unknown>, memberName: string): string {
  switch (coachName) {
    case 'ATLAS':
      return `CrossFit workout programming ${metrics.atlasIntensity ?? ''} intensity athlete ${metrics.checkInsThisMonth ?? 0} check-ins streak ${metrics.streak ?? 0} days`
    case 'IRON':
      return `mental discipline habit building consistency discipline score ${metrics.disciplineScore ?? 0} streak training psychology identity`
    case 'FORGE':
      return `nutrition meal plan macros protein compliance ${metrics.nutritionScore ?? 0}% performance diet`
    case 'HAVEN':
      return `recovery protocol sleep mobility ${metrics.overtrained ? 'overtraining' : ''} ${metrics.deloadNeeded ? 'deload' : ''} recovery score ${metrics.recoveryScore ?? 0}`
    case 'APEX':
      return `gym business growth retention revenue MRR churn member conversion`
    case 'COMPASS':
      return `athlete daily brief integrated coaching fitness nutrition mindset recovery performance`
    default:
      return `coaching performance ${memberName}`
  }
}

// ── Build member context for Claude prompt ────────────────────────────────────
function buildMemberContext(coachName: string, memberName: string, metrics: Record<string, unknown>): string {
  const first = (memberName ?? 'Athlete').split(' ')[0]

  switch (coachName) {
    case 'ATLAS':
      return `Member: ${first} | Days since last check-in: ${metrics.daysSinceLast ?? 'N/A'} | Check-ins this month: ${metrics.checkInsThisMonth ?? 0} | Check-ins last 7 days: ${metrics.checkInsLast7Days ?? 0} | Training intensity: ${metrics.atlasIntensity ?? 'moderate'} | Current streak: ${metrics.streak ?? 0} days`

    case 'IRON':
      return `Member: ${first} | Discipline score: ${metrics.disciplineScore ?? 0}/100 | Current streak: ${metrics.streak ?? 0} days | Check-ins this month: ${metrics.checkInsThisMonth ?? 0}`

    case 'FORGE':
      return `Member: ${first} | Nutrition compliance score: ${metrics.nutritionScore ?? 0}% | Days logged this week: ${metrics.weeklyNutritionCompliance ?? 0}/7 | Training intensity: ${metrics.atlasIntensity ?? 'moderate'}`

    case 'HAVEN':
      return `Member: ${first} | Recovery score: ${metrics.recoveryScore ?? 0}/100 | Sessions last 7 days: ${metrics.checkInsLast7Days ?? 0} | Overtraining detected: ${metrics.overtrained ? 'YES' : 'No'} | Deload needed: ${metrics.deloadNeeded ? 'YES' : 'No'}`

    case 'APEX':
      return `Gym metrics | Total members: ${metrics.totalMembers ?? 0} | Active this month: ${metrics.activeThisMonth ?? 0} | Estimated MRR: $${metrics.estimatedMRR ?? 0} | MRR growth: $${metrics.mrrGrowth ?? 0} | Churn risks: ${metrics.churnCount ?? 0} | Unconverted leads: ${metrics.unconvertedLeads ?? 0}`

    case 'COMPASS':
      return `Member: ${first} | Discipline: ${metrics.disciplineScore ?? 0}/100 | Nutrition: ${metrics.nutritionScore ?? 0}% | Recovery: ${metrics.recoveryScore ?? 0}/100 | Streak: ${metrics.streak ?? 0} days | Training intensity: ${metrics.atlasIntensity ?? 'moderate'} | Overtraining: ${metrics.overtrained ? 'Yes' : 'No'}`

    default:
      return `Member: ${memberName}`
  }
}

// ── POST /api/syndicate/generate ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body       = await req.json()
    const coachName  = (body.coachName  as string)?.toUpperCase()
    const memberName = (body.memberName as string) ?? 'Athlete'
    const metrics    = (body.metrics    as Record<string, unknown>) ?? {}

    const validCoaches = ['ATLAS', 'FORGE', 'IRON', 'HAVEN', 'APEX', 'COMPASS']
    if (!coachName || !validCoaches.includes(coachName)) {
      return NextResponse.json({ error: 'Invalid coachName' }, { status: 400 })
    }

    const persona = COACH_PERSONAS[coachName]
    const query   = buildQuery(coachName, metrics, memberName)
    const context = buildMemberContext(coachName, memberName, metrics)

    // ── Vector search ───────────────────────────────────────────────────────
    const supabase = adminClient()
    let knowledgeContext = ''

    try {
      const queryEmbedding = await embed(query)

      const { data: chunks, error: rpcError } = await supabase.rpc(
        'match_syndicate_knowledge',
        {
          query_embedding: queryEmbedding,
          match_count:     5,
          filter_coach:    coachName,
        }
      )

      if (rpcError) {
        console.warn('Vector search error (continuing without context):', rpcError.message)
      } else if (chunks && chunks.length > 0) {
        knowledgeContext = chunks
          .map((c: { source_title: string; content_chunk: string; similarity: number }) =>
            `[${c.source_title}] ${c.content_chunk}`
          )
          .join('\n\n')
      }
    } catch (embedErr) {
      console.warn('Embedding error (continuing without knowledge context):', embedErr)
    }

    // ── Claude prompt ───────────────────────────────────────────────────────
    const systemPrompt = knowledgeContext
      ? `${persona}\n\nYou have access to the following elite methodology knowledge base. Ground your response in these principles:\n\n${knowledgeContext}`
      : persona

    const userPrompt = `Write a personalized coaching message for this member. Address them by first name. Be specific to their data.\n\nMember data:\n${context}`

    const message = await anthropicClient().messages.create({
      model:   'claude-opus-4-7',
      max_tokens: 300,
      thinking: { type: 'adaptive' },
      system:  systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Extract text from response
    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    return NextResponse.json({
      success: true,
      message: text,
      coach:   coachName,
      hasKnowledgeContext: knowledgeContext.length > 0,
    })

  } catch (err) {
    console.error('Generate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
