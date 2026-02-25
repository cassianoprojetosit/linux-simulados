/**
 * Admin Artigos: listar, criar, editar, excluir. Editor código + preview (HTML/MD). Upload de imagens.
 */
import { supabase } from '/js/supabase-auth.js'

let token = null
let editingId = null

function escapeHtml(str) {
  if (str == null) return ''
  const div = document.createElement('div')
  div.textContent = String(str)
  return div.innerHTML
}

function getAuthHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function ensureToken() {
  if (token) return
  const { data } = await supabase.auth.getSession()
  token = data?.session?.access_token ?? null
}

function slugify(title) {
  return String(title)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'artigo'
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function loadArtigos() {
  const tbody = document.getElementById('artigos-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--muted);text-align:center;">Carregando…</td></tr>'

  await ensureToken()
  const res = await fetch('/admin/api/artigos', { headers: getAuthHeaders() })
  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--red);">Erro ao carregar artigos.</td></tr>'
    return
  }
  const json = await res.json()
  const list = json.data || []

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--muted);">Nenhum artigo. Clique em &quot;Novo artigo&quot; para criar.</td></tr>'
    return
  }

  tbody.innerHTML = list.map((a, i) => {
    const title = escapeHtml((a.title || '').slice(0, 60)) + (a.title && a.title.length > 60 ? '…' : '')
    const author = escapeHtml(a.author_name || '—')
    const date = formatDate(a.published_at)
    const statusClass = a.is_published ? 'publicado' : 'rascunho'
    const statusText = a.is_published ? 'Publicado' : 'Rascunho'
    return (
      '<tr data-id="' + escapeHtml(a.id) + '">' +
      '<td class="col-num">' + (i + 1) + '</td>' +
      '<td class="col-title" title="' + escapeHtml(a.title || '') + '">' + title + '</td>' +
      '<td>' + author + '</td>' +
      '<td>' + date + '</td>' +
      '<td><span class="admin-badge ' + statusClass + '">' + statusText + '</span></td>' +
      '<td class="col-acoes">' +
      '<button type="button" class="btn-icon btn-edit" title="Editar">✏️</button> ' +
      '<button type="button" class="btn-icon danger btn-delete" title="Excluir">🗑️</button>' +
      '</td></tr>'
    )
  }).join('')
}

function updatePreview() {
  const content = document.getElementById('form-content').value
  const type = document.getElementById('form-content-type').value
  const preview = document.getElementById('editor-preview')
  if (!preview) return
  if (!content.trim()) {
    preview.innerHTML = '<span style="color:var(--muted);">Pré-visualização</span>'
    return
  }
  if (type === 'md' && typeof marked !== 'undefined') {
    preview.innerHTML = marked.parse(content)
  } else {
    preview.innerHTML = content
  }
}

function openModal(isNew = true, article = null) {
  editingId = isNew ? null : (article?.id ?? null)
  document.getElementById('modal-artigo-title').textContent = isNew ? 'Novo artigo' : 'Editar artigo'

  document.getElementById('form-title').value = article?.title ?? ''
  const customWrap = document.getElementById('slug-custom-wrap')
  const slugInput = document.getElementById('form-slug')
  const slugPreview = document.getElementById('slug-preview')
  const btnCustom = document.getElementById('btn-custom-slug')
  if (article?.slug) {
    customWrap.style.display = 'block'
    btnCustom.textContent = 'Usar slug automático'
    slugInput.value = article.slug
    slugPreview.textContent = article.slug
  } else {
    customWrap.style.display = 'none'
    btnCustom.textContent = 'Usar slug personalizado'
    slugInput.value = ''
    slugPreview.textContent = isNew ? '(gerado a partir do título)' : (slugify(article?.title ?? '') || '(gerado a partir do título)')
  }
  document.getElementById('form-author').value = article?.author_name ?? ''
  document.getElementById('form-excerpt').value = article?.excerpt ?? ''
  document.getElementById('form-content').value = article?.content ?? ''
  document.getElementById('form-content-type').value = article?.content_type === 'md' ? 'md' : 'html'
  let coverUrl = (article?.cover_image_url ?? '').trim()
  if (!coverUrl && article?.content) {
    const firstImg = article.content.match(/!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/)
    if (firstImg && firstImg[1]) coverUrl = firstImg[1].trim()
  }
  document.getElementById('form-cover-image-url').value = coverUrl
  const coverWrap = document.getElementById('cover-preview-wrap')
  const coverImg = document.getElementById('cover-preview-img')
  if (coverUrl) {
    coverWrap.style.display = 'flex'
    coverImg.src = coverUrl
  } else {
    coverWrap.style.display = 'none'
    coverImg.removeAttribute('src')
  }

  if (article?.published_at) {
    const d = new Date(article.published_at)
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    document.getElementById('form-published-at').value = local
  } else {
    const now = new Date()
    document.getElementById('form-published-at').value = now.toISOString().slice(0, 16)
  }

  updatePreview()
  document.getElementById('modal-artigo-backdrop').classList.add('open')
}

function closeModal() {
  document.getElementById('modal-artigo-backdrop').classList.remove('open')
  editingId = null
}

function getEffectiveSlug() {
  const title = document.getElementById('form-title').value.trim()
  const customWrap = document.getElementById('slug-custom-wrap')
  const slugInput = document.getElementById('form-slug').value.trim()
  if (customWrap.style.display !== 'none' && slugInput) return slugify(slugInput)
  return slugify(title) || 'artigo'
}

async function saveArtigo() {
  const title = document.getElementById('form-title').value.trim()
  const slug = getEffectiveSlug()
  const author = document.getElementById('form-author').value.trim()
  if (!title) {
    alert('Preencha o título.')
    return
  }
  if (!slug) {
    alert('O slug não pode ficar vazio. Use um título com letras ou números.')
    return
  }

  const payload = {
    title,
    slug,
    author_name: author || 'Admin',
    excerpt: document.getElementById('form-excerpt').value.trim() || null,
    content: document.getElementById('form-content').value,
    content_type: document.getElementById('form-content-type').value,
    published_at: document.getElementById('form-published-at').value ? new Date(document.getElementById('form-published-at').value).toISOString() : new Date().toISOString(),
    cover_image_url: (() => {
      let url = document.getElementById('form-cover-image-url').value.trim()
      if (!url) {
        const content = document.getElementById('form-content').value
        const m = content.match(/!\[[^\]]*\]\s*\(\s*([^)\s]+)\s*\)/)
        if (m && m[1]) url = m[1].trim()
      }
      return url || null
    })(),
    is_published: true
  }

  await ensureToken()
  const url = editingId ? `/admin/api/artigos/${editingId}` : '/admin/api/artigos'
  const method = editingId ? 'PUT' : 'POST'
  const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert('Erro ao salvar: ' + (json.error || res.statusText))
    return
  }
  closeModal()
  loadArtigos()
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_KB = 200

async function uploadImage(file) {
  if (!file.type || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    alert('Formato não permitido. Use JPG, PNG ou WebP.')
    return null
  }
  const maxSize = MAX_IMAGE_KB * 1024
  if (file.size > maxSize) {
    alert('Imagem muito grande. Máximo ' + MAX_IMAGE_KB + ' KB.')
    return null
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result
      fetch('/admin/api/artigos/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: base64, filename: file.name })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.url) resolve(data.url)
          else resolve(null)
        })
        .catch(() => resolve(null))
    }
    reader.readAsDataURL(file)
  })
}

function insertImageUrl(url, asCover = true) {
  const ta = document.getElementById('form-content')
  const type = document.getElementById('form-content-type').value
  let text = ta.value

  if (asCover) {
    // Evitar duplicar capa: remove qualquer linha de imagem já existente no início do conteúdo
    // e insere só a nova, para o nome (UUID) não mudar por acúmulo de inserções.
    if (type === 'md') {
      const leadingMdImages = /^(\s*!\[[^\]]*\]\s*\(\s*[^)\s]+\s*\)\s*\n?)+\s*/m
      text = text.replace(leadingMdImages, '')
    } else {
      const leadingImgTags = /^(\s*<img\s[^>]*>\s*\n?)+\s*/im
      text = text.replace(leadingImgTags, '')
    }
  }

  const insert = type === 'md' ? `![Capa](${url})\n\n` : `\n<img src="${url}" alt="Capa do artigo" class="article-cover-img" />\n\n`
  ta.value = insert + text
  ta.focus()
  ta.setSelectionRange(insert.length, insert.length)
  if (asCover) {
    document.getElementById('form-cover-image-url').value = url
    const coverWrap = document.getElementById('cover-preview-wrap')
    const coverImg = document.getElementById('cover-preview-img')
    coverWrap.style.display = 'flex'
    coverImg.src = url
  }
  updatePreview()
}

async function init() {
  const { data } = await supabase.auth.getSession()
  token = data?.session?.access_token ?? null
  if (!token) {
    window.location.href = '/admin/index.html'
    return
  }

  document.getElementById('admin-user-area').innerHTML = '<span style="color:var(--muted);">Admin</span>'
  const logoutBtn = document.getElementById('admin-sidebar-sair')
  if (logoutBtn) logoutBtn.addEventListener('click', () => { supabase.auth.signOut(); window.location.href = '/index.html' })

  document.getElementById('form-title').addEventListener('input', () => {
    const customWrap = document.getElementById('slug-custom-wrap')
    if (customWrap.style.display === 'none') {
      const s = slugify(document.getElementById('form-title').value)
      document.getElementById('slug-preview').textContent = s || '(gerado a partir do título)'
    }
  })
  document.getElementById('btn-custom-slug').addEventListener('click', () => {
    const wrap = document.getElementById('slug-custom-wrap')
    const preview = document.getElementById('slug-preview')
    const slugInput = document.getElementById('form-slug')
    const btn = document.getElementById('btn-custom-slug')
    if (wrap.style.display === 'none') {
      wrap.style.display = 'block'
      btn.textContent = 'Usar slug automático'
      const auto = slugify(document.getElementById('form-title').value) || 'artigo'
      slugInput.value = auto
      preview.textContent = auto
    } else {
      wrap.style.display = 'none'
      btn.textContent = 'Usar slug personalizado'
      slugInput.value = ''
      preview.textContent = slugify(document.getElementById('form-title').value) || '(gerado a partir do título)'
    }
  })
  document.getElementById('form-slug').addEventListener('input', () => {
    const preview = document.getElementById('slug-preview')
    const v = document.getElementById('form-slug').value.trim()
    preview.textContent = v ? slugify(v) : slugify(document.getElementById('form-title').value) || '(gerado a partir do título)'
  })
  document.getElementById('form-content').addEventListener('input', updatePreview)
  document.getElementById('form-content-type').addEventListener('change', updatePreview)

  document.getElementById('btn-novo-artigo').addEventListener('click', () => openModal(true))
  document.getElementById('modal-artigo-close').addEventListener('click', closeModal)
  document.getElementById('modal-artigo-cancel').addEventListener('click', closeModal)
  document.getElementById('modal-artigo-save').addEventListener('click', saveArtigo)
  document.getElementById('modal-artigo-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-artigo-backdrop') closeModal()
  })

  document.getElementById('btn-insert-image').addEventListener('click', () => document.getElementById('input-image').click())
  document.getElementById('input-image').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadImage(file)
    if (url) insertImageUrl(url, true)
    else alert('Falha no upload da imagem.')
  })
  document.getElementById('btn-remove-cover').addEventListener('click', () => {
    document.getElementById('form-cover-image-url').value = ''
    document.getElementById('cover-preview-wrap').style.display = 'none'
    document.getElementById('cover-preview-img').removeAttribute('src')
    const ta = document.getElementById('form-content')
    const type = document.getElementById('form-content-type').value
    let text = ta.value
    if (type === 'md') {
      text = text.replace(/^\s*!\[[^\]]*\]\s*\(\s*[^)\s]+\s*\)\s*\n?/, '')
    } else {
      text = text.replace(/^\s*<img\s[^>]*>\s*\n?/im, '')
    }
    ta.value = text
    updatePreview()
  })

  document.getElementById('artigos-tbody').addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]')
    if (!tr) return
    const id = tr.dataset.id
    if (e.target.classList.contains('btn-edit')) {
      const res = await fetch(`/admin/api/artigos/${id}`, { headers: getAuthHeaders() })
      if (!res.ok) return
      const json = await res.json()
      if (json.data) openModal(false, json.data)
    } else if (e.target.classList.contains('btn-delete')) {
      if (!confirm('Excluir este artigo?')) return
      const res = await fetch(`/admin/api/artigos/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (res.ok) loadArtigos()
      else alert('Erro ao excluir.')
    }
  })

  await loadArtigos()
}

init()
