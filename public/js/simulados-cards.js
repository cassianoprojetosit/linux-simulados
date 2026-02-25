/**
 * Preenche os cards de simulados a partir da API (GET /api/simulados).
 * Só exibe simulados ativos cadastrados no banco; remove exemplos/placeholders.
 * Usado em index.html (Simulados Mais Acessados) e simulados.html (Simulados disponíveis).
 * Na página simulados.html: busca em tempo real ao digitar + filtro por status.
 */
import { supabase } from '/js/supabase-auth.js'

const CONTAINER_ID_INDEX = 'simulados-cards'
const CONTAINER_ID_PAGE = 'simulados-grid'

let fullSimuladosList = []
let lastHasSession = false

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
    container.innerHTML = '<p class="card-desc" style="grid-column:1/-1;color:var(--muted);">Nenhum simulado encontrado.</p>'
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

function applyFilters () {
  const container = document.getElementById(CONTAINER_ID_PAGE)
  if (!container || fullSimuladosList.length === 0) return
  const searchEl = document.getElementById('search-simulados')
  const filterEl = document.getElementById('filter-simulados')
  const q = (searchEl && searchEl.value) ? String(searchEl.value).trim().toLowerCase() : ''
  const statusFilter = (filterEl && filterEl.value) ? filterEl.value : ''
  let list = fullSimuladosList
  if (q) {
    list = list.filter((s) => {
      const title = (s.title || '').toLowerCase()
      const slug = (s.slug || '').toLowerCase()
      return title.includes(q) || slug.includes(q)
    })
  }
  if (statusFilter === 'embreve') {
    list = list.filter((s) => s.coming_soon === true)
  }
  if (statusFilter === 'disponivel') {
    list = list.filter((s) => s.is_active !== false)
  }
  renderCards(container, list, lastHasSession)
}

function bindSearchAndFilter () {
  const searchEl = document.getElementById('search-simulados')
  const filterEl = document.getElementById('filter-simulados')
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = '1'
    searchEl.addEventListener('input', applyFilters)
    searchEl.addEventListener('search', applyFilters)
  }
  if (filterEl && !filterEl.dataset.bound) {
    filterEl.dataset.bound = '1'
    filterEl.addEventListener('change', applyFilters)
  }
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
    lastHasSession = hasSession
    if (container.id === CONTAINER_ID_PAGE) {
      fullSimuladosList = list.slice()
      renderCards(container, list, hasSession)
      bindSearchAndFilter()
    } else {
      fullSimuladosList = []
      renderCards(container, list, hasSession)
    }
  } catch (e) {
    container.innerHTML = '<p class="card-desc" style="grid-column:1/-1;color:var(--red);">Erro ao carregar simulados.</p>'
  }
}

async function init () {
  const { data: { session } } = await supabase.auth.getSession()
  await loadAndRender(session)
  supabase.auth.onAuthStateChange((_event, session) => {
    lastHasSession = !!(session && session.access_token)
    loadAndRender(session)
  })
}

init()
