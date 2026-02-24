/** Garante que o hash da URL (OAuth) seja capturado antes do createClient limpá-lo. */
import '/js/hash-capture.js'

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Config do Supabase vem do backend (rota /api/config), para evitar duplicar URL/chave anon no código.
// A chave anon continua pública (enviada ao navegador), mas a fonte de verdade passa a ser o .env do servidor.
async function loadSupabaseConfig () {
  const res = await fetch('/api/config', { credentials: 'same-origin' })
  if (!res.ok) {
    throw new Error(`Falha ao carregar config do Supabase: ${res.status}`)
  }
  const json = await res.json().catch(() => ({}))
  if (!json.supabaseUrl || !json.supabaseAnonKey) {
    throw new Error('Resposta de /api/config inválida (faltando supabaseUrl ou supabaseAnonKey)')
  }
  return json
}

const { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY } = await loadSupabaseConfig()

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storageKey: 'linuxgeek-auth',
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true
    }
  }
)

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Inicia login com Google OAuth.
 * O Supabase retorna { data: { url }, error }; em ambiente browser
 * é necessário redirecionar explicitamente para data.url (boas práticas da doc).
 */
export async function loginWithGoogle() {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/index.html` : 'http://localhost:3000/index.html'
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' }
    }
  })
  if (error) {
    console.error('Erro ao iniciar login com Google:', error.message)
    if (typeof window !== 'undefined') {
      alert('Não foi possível iniciar o login com o Google. Tente novamente em instantes.\\n\\nDetalhe técnico: ' + (error.message || 'erro desconhecido'))
    }
    return
  }
  if (data?.url) {
    window.location.href = data.url
  } else {
    console.error('Supabase não retornou URL de redirecionamento.')
    if (typeof window !== 'undefined') {
      alert('Não foi possível redirecionar para o Google. Recarregue a página e tente novamente.')
    }
  }
}

export async function logout() {
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.warn('[logout] signOut falhou:', e?.message || e)
  }
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('sb-') || k === 'linuxgeek-auth')) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
    try { sessionStorage.removeItem('newsletter_popup_shown') } catch (_) {}
    try { localStorage.removeItem('newsletter_opt_in') } catch (_) {}
  } catch (_) {}
  if (typeof window !== 'undefined') {
    const ts = Date.now()
    window.location.href = `/index.html?logout=${ts}`
  }
}
