/**
 * Sincroniza resultados de simulados com Supabase (por usuário).
 * Expõe window.saveProgressToCloud(sessionData) para o engine chamar ao finalizar.
 *
 * Tabela no Supabase: sessions
 * Colunas: user_id (uuid, FK auth.users), id (text), simulado (text), simulado_label (text),
 * exam (text), mode (text), date (text), date_timestamp (int8), duration (int), total (int),
 * correct (int), wrong (int), score (int), passed (bool), topics_stats (jsonb), weak_topics (jsonb).
 * RLS: habilitar com política (SELECT, INSERT, DELETE) WHERE auth.uid() = user_id.
 */
import { supabase } from '/js/supabase-auth.js'

export async function saveProgressToCloud(sessionData) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  try {
    const id = sessionData.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionData.id)
      ? sessionData.id
      : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : sessionData.id);
    const row = {
      user_id: session.user.id,
      id: id,
      simulado: sessionData.simulado,
      simulado_label: sessionData.simuladoLabel ?? sessionData.simulado_label,
      exam: sessionData.exam,
      mode: sessionData.mode,
      date: sessionData.date,
      date_timestamp: sessionData.dateTimestamp ?? sessionData.date_timestamp,
      duration: sessionData.duration,
      total: sessionData.total,
      correct: sessionData.correct,
      wrong: sessionData.wrong,
      score: sessionData.score,
      passed: sessionData.passed,
      topics_stats: sessionData.topicsStats ?? sessionData.topics_stats ?? null,
      weak_topics: sessionData.weakTopics ?? sessionData.weak_topics ?? null
    }
    const { error } = await supabase.from('sessions').insert([row])
    if (error) {
      console.error('[Progresso] Erro ao salvar na nuvem:', error.message, error)
    } else {
      console.log('[Progresso] Resultado salvo na nuvem com sucesso.')
    }
  } catch (e) {
    console.warn('[Progresso] Erro ao salvar na nuvem:', e)
  }
}

window.saveProgressToCloud = saveProgressToCloud
