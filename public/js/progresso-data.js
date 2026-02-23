/**
 * Carrega sessões de progresso do Supabase (por usuário) para a página Meu Progresso.
 * Dispara 'progresso-ready' com window.__sessions preenchido.
 */
import { supabase } from '/js/supabase-auth.js'

const KEY = 'linuxgeek_progress'

function rowToSession(row) {
  const score = row.score != null ? Number(row.score) : 0
  return {
    id: row.id != null ? String(row.id) : '',
    simulado: row.simulado ?? 'lpic1',
    simuladoLabel: row.simulado_label ?? row.simuladoLabel ?? 'LPIC-1',
    exam: row.exam ?? '',
    mode: row.mode ?? '',
    date: row.date ?? new Date().toISOString().split('T')[0],
    dateTimestamp: row.date_timestamp != null ? Number(row.date_timestamp) : row.dateTimestamp ?? Date.now(),
    duration: row.duration != null ? Number(row.duration) : 0,
    total: row.total != null ? Number(row.total) : 0,
    correct: row.correct != null ? Number(row.correct) : 0,
    wrong: row.wrong != null ? Number(row.wrong) : 0,
    score: score,
    passed: Boolean(row.passed),
    topicsStats: row.topics_stats ?? row.topicsStats ?? null,
    weakTopics: row.weak_topics ?? row.weakTopics ?? null
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function deleteProgressSession(sessionId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  await supabase.from('sessions').delete().eq('id', sessionId).eq('user_id', session.user.id)
}

window.deleteProgressSession = deleteProgressSession

async function loadSessionsForProgresso() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    window.__sessions = loadFromLocalStorage()
    console.log('[Meu Progresso] Sem login: carregadas', window.__sessions.length, 'sessões do dispositivo.')
    setTimeout(function () { document.dispatchEvent(new CustomEvent('progresso-ready')) }, 0)
    return
  }
  try {
    const { data: rows, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date_timestamp', { ascending: false })
    if (error) {
      console.warn('[Meu Progresso] Erro ao carregar da nuvem:', error.message)
      window.__sessions = loadFromLocalStorage()
      console.log('[Meu Progresso] Usando dispositivo:', window.__sessions.length, 'sessões.')
    } else {
      const cloud = (rows || []).map(rowToSession)
      window.__sessions = cloud.length > 0 ? cloud : loadFromLocalStorage()
      console.log('[Meu Progresso] Carregadas', window.__sessions.length, 'sessões.', cloud.length > 0 ? '(nuvem)' : '(dispositivo, nuvem vazia)')
    }
  } catch (e) {
    console.warn('[Meu Progresso] Erro:', e)
    window.__sessions = loadFromLocalStorage()
    console.log('[Meu Progresso] Usando dispositivo:', window.__sessions.length, 'sessões.')
  }
  setTimeout(function () {
    document.dispatchEvent(new CustomEvent('progresso-ready'))
  }, 0)
}

loadSessionsForProgresso()
