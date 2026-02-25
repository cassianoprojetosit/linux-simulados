/**
 * Carrega a lista de artigos na página /artigos.html (pública).
 * Busca em tempo real ao digitar + filtro por tipo (Guias/Tutoriais).
 * Arquivo externo para respeitar CSP (script-src 'self').
 */
(function () {
  const grid = document.getElementById('artigos-grid')
  if (!grid) return

  const icons = ['🚀', '🔧', '🌐', '🔐', '📦', '📚', '🐧', '⚙️']
  let fullList = []

  function escape (s) {
    if (s == null) return ''
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function render (list) {
    if (!Array.isArray(list) || list.length === 0) {
      grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;">Nenhum artigo encontrado.</p>'
      return
    }
    grid.innerHTML = list.map((a, i) => {
      const href = '/artigo.html?slug=' + encodeURIComponent(a.slug || '')
      const excerpt = (a.excerpt || '').slice(0, 120) + (a.excerpt && a.excerpt.length > 120 ? '…' : '')
      const date = a.published_at ? new Date(a.published_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : ''
      const iconHtml = a.cover_image_url
        ? '<img src="' + escape(a.cover_image_url) + '" alt="" style="width:100%;height:100%;object-fit:cover;">'
        : icons[i % icons.length]
      return '<a href="' + href + '" class="article-card">' +
        '<div class="article-hero-img">' + iconHtml + '</div>' +
        '<div class="article-body">' +
        '<div class="article-tag">' + escape(a.author_name) + '</div>' +
        '<div class="article-title">' + escape(a.title) + '</div>' +
        '<div class="article-desc">' + escape(excerpt) + '</div>' +
        '<div class="article-meta"><span>📅 ' + date + '</span></div>' +
        '</div></a>'
    }).join('')
  }

  function applyFilters () {
    const q = (document.getElementById('search-artigos')?.value || '').trim().toLowerCase()
    const filterVal = (document.getElementById('filter-artigos')?.value || '').toLowerCase()
    let list = fullList
    if (q) {
      list = list.filter((a) => {
        const title = (a.title || '').toLowerCase()
        const slug = (a.slug || '').toLowerCase()
        const excerpt = (a.excerpt || '').toLowerCase()
        const author = (a.author_name || '').toLowerCase()
        return title.includes(q) || slug.includes(q) || excerpt.includes(q) || author.includes(q)
      })
    }
    if (filterVal === 'guia') {
      list = list.filter((a) => {
        const t = (a.title || '').toLowerCase()
        const e = (a.excerpt || '').toLowerCase()
        return t.includes('guia') || e.includes('guia')
      })
    }
    if (filterVal === 'tutorial') {
      list = list.filter((a) => {
        const t = (a.title || '').toLowerCase()
        const e = (a.excerpt || '').toLowerCase()
        return t.includes('tutorial') || e.includes('tutorial')
      })
    }
    render(list)
  }

  function bindSearchAndFilter () {
    const searchEl = document.getElementById('search-artigos')
    const filterEl = document.getElementById('filter-artigos')
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

  async function load () {
    grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;">Carregando artigos…</p>'
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 10000)
      const res = await fetch('/api/artigos', { signal: ctrl.signal })
      clearTimeout(t)
      const json = await res.json().catch(() => ({}))
      const list = json.data || []
      if (!res.ok) {
        grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;">Não foi possível carregar os artigos. Tente recarregar a página.</p>'
        return
      }
      fullList = list
      if (list.length === 0) {
        grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;">Nenhum artigo publicado ainda.</p>'
        return
      }
      render(list)
      bindSearchAndFilter()
    } catch (e) {
      const msg = e.name === 'AbortError' ? 'Demorou demais. Verifique sua conexão e recarregue.' : 'Erro ao carregar artigos. Tente recarregar a página.'
      grid.innerHTML = '<p style="color:var(--muted);grid-column:1/-1;">' + msg + '</p>'
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load)
  } else {
    load()
  }
})()
