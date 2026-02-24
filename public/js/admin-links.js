/**
 * Admin Links Úteis: listar, criar, editar, excluir. Upload de ícone (imagem pequena) por link.
 */
import { supabase } from '/js/supabase-auth.js'

let token = null
let editingId = null

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_KB = 200

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

async function loadLinks() {
  const tbody = document.getElementById('links-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--muted);text-align:center;">Carregando…</td></tr>'

  await ensureToken()
  const res = await fetch('/admin/api/links', { headers: getAuthHeaders() })
  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--red);">Erro ao carregar links.</td></tr>'
    return
  }
  const json = await res.json()
  const list = json.data || []

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--muted);">Nenhum link. Clique em &quot;Novo link&quot; para adicionar.</td></tr>'
    return
  }

  tbody.innerHTML = list.map((item, i) => {
    const name = escapeHtml((item.name || '').slice(0, 40)) + (item.name && item.name.length > 40 ? '…' : '')
    const url = escapeHtml((item.url || '').slice(0, 35)) + (item.url && item.url.length > 35 ? '…' : '')
    const label = escapeHtml(item.label || '—')
    const iconCell = item.icon_url
      ? '<img src="' + escapeHtml(item.icon_url) + '" alt="">'
      : '—'
    return (
      '<tr data-id="' + escapeHtml(item.id) + '">' +
      '<td class="col-num">' + (i + 1) + '</td>' +
      '<td class="link-icon-cell">' + iconCell + '</td>' +
      '<td class="col-name" title="' + escapeHtml(item.name || '') + '">' + name + '</td>' +
      '<td>' + label + '</td>' +
      '<td class="col-url" title="' + escapeHtml(item.url || '') + '">' + url + '</td>' +
      '<td class="col-acoes">' +
      '<button type="button" class="btn-icon btn-edit" title="Editar">✏️</button> ' +
      '<button type="button" class="btn-icon danger btn-delete" title="Excluir">🗑️</button>' +
      '</td></tr>'
    )
  }).join('')
}

function openModal(isNew = true, link = null) {
  editingId = isNew ? null : (link?.id ?? null)
  document.getElementById('modal-link-title').textContent = isNew ? 'Novo link' : 'Editar link'

  document.getElementById('form-link-name').value = link?.name ?? ''
  document.getElementById('form-link-url').value = link?.url ?? ''
  document.getElementById('form-link-desc').value = link?.description ?? ''
  document.getElementById('form-link-label').value = link?.label ?? ''
  document.getElementById('form-link-order').value = link?.sort_order ?? 0

  const iconUrl = link?.icon_url ?? ''
  document.getElementById('form-link-icon-url').value = iconUrl
  const wrap = document.getElementById('icon-preview-wrap')
  const img = document.getElementById('icon-preview-img')
  if (iconUrl) {
    wrap.style.display = 'flex'
    img.src = iconUrl
  } else {
    wrap.style.display = 'none'
    img.removeAttribute('src')
  }

  document.getElementById('modal-link-backdrop').classList.add('open')
}

function closeModal() {
  document.getElementById('modal-link-backdrop').classList.remove('open')
  editingId = null
}

async function saveLink() {
  const name = document.getElementById('form-link-name').value.trim()
  const url = document.getElementById('form-link-url').value.trim()
  if (!name || !url) {
    alert('Preencha nome e URL.')
    return
  }
  if (!/^https?:\/\/.+/.test(url)) {
    alert('URL deve começar com http:// ou https://')
    return
  }

  const payload = {
    name,
    url,
    description: document.getElementById('form-link-desc').value.trim() || null,
    label: document.getElementById('form-link-label').value.trim() || null,
    icon_url: document.getElementById('form-link-icon-url').value.trim() || null,
    sort_order: parseInt(document.getElementById('form-link-order').value, 10) || 0
  }

  await ensureToken()
  const apiUrl = editingId ? `/admin/api/links/${editingId}` : '/admin/api/links'
  const method = editingId ? 'PUT' : 'POST'
  const res = await fetch(apiUrl, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert('Erro ao salvar: ' + (json.error || res.statusText))
    return
  }
  closeModal()
  loadLinks()
}

async function uploadIcon(file) {
  if (!file.type || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    alert('Formato não permitido. Use JPG, PNG ou WebP.')
    return null
  }
  if (file.size > MAX_IMAGE_KB * 1024) {
    alert('Imagem muito grande. Máximo ' + MAX_IMAGE_KB + ' KB.')
    return null
  }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      fetch('/admin/api/links/upload', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ data: reader.result, filename: file.name })
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.url) resolve(data.url)
          else resolve(null)
        })
        .catch(() => resolve(null))
    }
    reader.readAsDataURL(file)
  })
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

  document.getElementById('btn-novo-link').addEventListener('click', () => openModal(true))
  document.getElementById('modal-link-close').addEventListener('click', closeModal)
  document.getElementById('modal-link-cancel').addEventListener('click', closeModal)
  document.getElementById('modal-link-save').addEventListener('click', saveLink)
  document.getElementById('modal-link-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-link-backdrop') closeModal()
  })

  document.getElementById('btn-upload-icon').addEventListener('click', () => document.getElementById('input-icon').click())
  document.getElementById('input-icon').addEventListener('change', async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadIcon(file)
    if (url) {
      document.getElementById('form-link-icon-url').value = url
      document.getElementById('icon-preview-wrap').style.display = 'flex'
      document.getElementById('icon-preview-img').src = url
    } else {
      alert('Falha no upload da imagem.')
    }
  })
  document.getElementById('btn-remove-icon').addEventListener('click', () => {
    document.getElementById('form-link-icon-url').value = ''
    document.getElementById('icon-preview-wrap').style.display = 'none'
    document.getElementById('icon-preview-img').removeAttribute('src')
  })

  document.getElementById('links-tbody').addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]')
    if (!tr) return
    const id = tr.dataset.id
    if (e.target.classList.contains('btn-edit')) {
      const res = await fetch(`/admin/api/links/${id}`, { headers: getAuthHeaders() })
      if (!res.ok) return
      const json = await res.json()
      if (json.data) openModal(false, json.data)
    } else if (e.target.classList.contains('btn-delete')) {
      if (!confirm('Excluir este link?')) return
      const res = await fetch(`/admin/api/links/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (res.ok) loadLinks()
      else alert('Erro ao excluir.')
    }
  })

  await loadLinks()
}

init()
