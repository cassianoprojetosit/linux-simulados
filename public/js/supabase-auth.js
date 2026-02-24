/** Garante que o hash da URL (OAuth) seja capturado antes do createClient limpá-lo. */
import '/js/hash-capture.js'

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Configuração fixa do Supabase (mesmos valores de /api/config em produção)
// Em desenvolvimento/local também apontará para o mesmo projeto do Supabase.
const SUPABASE_URL = 'https://tfmcvjwhicvoouhoxzqz.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_lq2WNnwMHRUqhVI6K-HY6g_9_vWmz7R'

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
