/** Garante que o hash da URL (OAuth) seja capturado antes do createClient limpá-lo. */
import '/js/hash-capture.js'

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Chave anon (pública) do Supabase — segura no frontend; RLS protege os dados.
// Nunca use a Service Role Key aqui. Para rotação, injete via build ou config.
const SUPABASE_URL = 'https://tfmcvjwhicvoouhoxzqz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmbWN2andoaWN2b291aG94enF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NjM5OTcsImV4cCI6MjA4NzIzOTk5N30.Y1KygrZq1hZtUzcYrTtfXKhtxf1NVoV8plgrL9imj1s'

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
    return
  }
  if (data?.url) {
    window.location.href = data.url
  } else {
    console.error('Supabase não retornou URL de redirecionamento.')
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
