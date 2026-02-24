/**
 * Ao ter sessão (login), registra o usuário em public.users e um acesso em public.access_log.
 * Assim você tem email no banco e histórico de acessos para newsletter etc.
 * Só dispara uma vez por sessão do navegador (sessionStorage).
 *
 * Inclui fallback com getSession() ao carregar: assim, se o onAuthStateChange já tiver
 * disparado antes do listener ser registrado (ex.: retorno do OAuth), o usuário ainda
 * é sincronizado para public.users e passa a aparecer na lista do admin.
 */
import { supabase, getSession } from '/js/supabase-auth.js'

const TRACKED_KEY = 'linuxgeek_login_tracked'

async function trackLogin(session) {
  if (!session?.user) return
  if (sessionStorage.getItem(TRACKED_KEY)) return

  try {
    const id = session.user.id
    const email = session.user.email || ''
    const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || null

    await supabase.from('users').upsert(
      {
        id,
        email,
        name,
        last_login_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    )

    await supabase.from('access_log').insert({
      user_id: id,
      email,
      logged_at: new Date().toISOString()
    })

    sessionStorage.setItem(TRACKED_KEY, '1')
  } catch (e) {
    console.warn('[track-login]', e.message)
  }
}

function onSession(session) {
  if (session) trackLogin(session)
}

supabase.auth.onAuthStateChange((_event, session) => {
  onSession(session)
})

// Fallback: sessão já existente ao carregar (ex.: retorno do OAuth) pode ter disparado
// o evento antes do listener estar registrado; garantir que o usuário seja registrado.
getSession().then(onSession)
