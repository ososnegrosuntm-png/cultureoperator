import { createClient }        from '@/lib/supabase/server'
import { redirect }             from 'next/navigation'
import { SyndicateKnowledge }   from '@/components/SyndicateKnowledge'

export const dynamic = 'force-dynamic'

export default async function SyndicateKnowledgePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <SyndicateKnowledge />
}
