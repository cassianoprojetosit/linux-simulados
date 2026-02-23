/**
 * Atualiza o card do simulado LPIC-1 conforme a sessão:
 * - Logado: link para simulado-lpic1.html, botão "Iniciar →"
 * - Não logado: link para login com redirect, botão "LOGIN"
 * Usado na index.html (Simulados Mais Acessados).
 */
import { supabase } from '/js/supabase-auth.js'

const CARD_ID = 'card-lpic1'
const BTN_SELECTOR = '.btn-start.btn-primary'
const LOGIN_URL = '/login.html?redirect=' + encodeURIComponent('simulado-lpic1.html')

async function updateLpic1Card() {
  const card = document.getElementById(CARD_ID)
  if (!card) return
  const btn = card.querySelector(BTN_SELECTOR)
  if (!btn) return

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    card.href = 'simulado-lpic1.html'
    btn.textContent = 'Iniciar →'
  } else {
    card.href = LOGIN_URL
    btn.textContent = 'LOGIN'
  }
}

// Atualizar na carga e quando a sessão mudar
updateLpic1Card()
supabase.auth.onAuthStateChange(() => updateLpic1Card())
