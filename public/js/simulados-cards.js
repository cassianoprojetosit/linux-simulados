/**
 * Preenche os cards de simulados a partir da API (GET /api/simulados).
 * Só exibe simulados ativos cadastrados no banco; remove exemplos/placeholders.
 * Usado em index.html (Simulados Mais Acessados) e simulados.html (Simulados disponíveis).
 */
import { supabase } from '/js/supabase-auth.js'

const CONTAINER_ID_INDEX = 'simulados-cards'
const CONTAINER_ID_PAGE = 'simulados-grid'

function escapeHtml (text) {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

function getStartUrl (slug, hasSession) {
  const configUrl = 'simulado.html?slug=' + encodeURIComponent(slug)
  return hasSession ? configUrl : '/login.html?redirect=' + encodeURIComponent(configUrl)
}

function getStartLabel (slug, hasSession) {
  return hasSession ? 'Iniciar →' : 'LOGIN'
}

function renderCards (container, list, hasSession) {
  if (!container || !Array.isArray(list)) return
  if (list.length === 0) {
    container.innerHTML = '<p class="card-desc" style="grid-column:1/-1;color:var(--muted);">Nenhum simulado disponível no momento.</p>'
    return
  }
  container.innerHTML = list.map((s) => {
    const slug = (s.slug || '').trim()
    const title = s.title || slug || 'Simulado'
    const isLink = slug === 'lpic1' || slug !== 'lpic1'
    const href = getStartUrl(slug, hasSession)
    const label = getStartLabel(slug, hasSession)
    const tag = isLink ? 'a' : 'div'
    const attr = isLink ? ` href="${escapeHtml(href)}"` : ' style="cursor:default"'
    return (
      `<${tag} class="exam-card card-lpic" data-slug="${escapeHtml(slug)}"${attr}>` +
      '<div class="card-badge badge-active">✦ Disponível</div>' +
      '<div class="card-icon icon-green">🐧</div>' +
      '<div class="card-title">' + escapeHtml(title) + '</div>' +
      '<div class="card-desc">Simulado ativo. Clique para iniciar.</div>' +
      '<div class="card-meta">' +
      '<div class="meta-pills"></div>' +
      '<span class="btn-start btn-primary">' + escapeHtml(label) + '</span>' +
      '</div></' + tag + '>'
    )
  }).join('')
}

async function loadAndRender (session) {
  const container = document.getElementById(CONTAINER_ID_INDEX) || document.getElementById(CONTAINER_ID_PAGE)
  if (!container) return
  container.innerHTML = '<p class="card-desc" style="grid-column:1/-1;color:var(--muted);">Carregando simulados…</p>'
  try {
    const res = await fetch('/api/simulados')
    const json = await res.json().catch(() => ({}))
    const list = json.data || []
    const hasSession = !!(session && session.access_token)
    renderCards(container, list, hasSession)
  } catch (e) {
    container.innerHTML = '<p class="card-desc" style="grid-column:1/-1;color:var(--red);">Erro ao carregar simulados.</p>'
  }
}

async function init () {
  const { data: { session } } = await supabase.auth.getSession()
  await loadAndRender(session)
  supabase.auth.onAuthStateChange((_event, session) => {
    loadAndRender(session)
  })
}

init()
