/**
 * Admin Simulados: listar, criar, editar e excluir simulados; gerenciar exames por simulado.
 * Segue o padrão de admin-auth (sessão + token) e layout do painel.
 */
import { supabase } from '/js/supabase-auth.js'

let token = null
let simulados = []
let editingSimuladoId = null
let editingExams = []
let editingExamId = null

function escapeHtml (text) {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

function getAuthHeaders () {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function slugFromTitle (title) {
  return String(title || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

async function ensureToken () {
  if (token) return
  const { data } = await supabase.auth.getSession()
  token = data?.session?.access_token ?? null
}

async function fetchSimulados () {
  const res = await fetch('/admin/api/simulados', { headers: getAuthHeaders() })
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

async function fetchExams (simuladoId) {
  if (!simuladoId) return []
  const res = await fetch(`/admin/api/exams?simulado_id=${encodeURIComponent(simuladoId)}`, { headers: getAuthHeaders() })
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

async function loadSimulados () {
  const tbody = document.getElementById('simulados-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;color:var(--text-dim);text-align:center;">Carregando…</td></tr>'

  await ensureToken()
  const list = await fetchSimulados()
  const withCounts = await Promise.all(
    list.map(async (s) => {
      const exams = await fetchExams(s.id)
      return { ...s, examCount: exams.length }
    })
  )
  simulados = withCounts

  if (withCounts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;color:var(--text-dim);text-align:center;">Nenhum simulado. Clique em "Novo simulado" para criar.</td></tr>'
    return
  }

  tbody.innerHTML = withCounts.map((s) => {
    const ativo = s.is_active !== false
    const premium = s.is_premium === true
    return (
      '<tr data-id="' + escapeHtml(s.id) + '">' +
      '<td>' + escapeHtml(s.title || '—') + '</td>' +
      '<td><code style="font-size:0.75rem;">' + escapeHtml(s.slug || '—') + '</code></td>' +
      '<td><span class="admin-badge ' + (ativo ? 'ativo' : 'inativo') + '">' + (ativo ? 'Sim' : 'Não') + '</span></td>' +
      '<td><span class="admin-badge ' + (premium ? 'premium' : 'inativo') + '">' + (premium ? 'Sim' : 'Não') + '</span></td>' +
      '<td>' + (s.passing_score != null ? s.passing_score + '%' : '—') + '</td>' +
      '<td>' + (s.examCount ?? 0) + '</td>' +
      '<td class="col-acoes">' +
      '<button type="button" class="btn-icon btn-edit" title="Editar">✏️</button> ' +
      '<button type="button" class="btn-icon btn-exams" title="Exames">📋</button> ' +
      '<button type="button" class="btn-icon danger btn-delete" title="Excluir">🗑️</button>' +
      '</td></tr>'
    )
  }).join('')
  attachRowHandlers()
}

function openModalSimulado (simulado = null) {
  editingSimuladoId = simulado?.id ?? null
  const titleEl = document.getElementById('modal-simulado-title')
  const formTitle = document.getElementById('form-simulado-title')
  const formSlug = document.getElementById('form-simulado-slug')
  const formPassing = document.getElementById('form-simulado-passing')
  const formActive = document.getElementById('form-simulado-active')
  const formPremium = document.getElementById('form-simulado-premium')
  const examsSection = document.getElementById('exams-section')

  if (simulado) {
    titleEl.textContent = 'Editar simulado'
    formTitle.value = simulado.title ?? ''
    formSlug.value = simulado.slug ?? ''
    formPassing.value = simulado.passing_score != null ? simulado.passing_score : 70
    formActive.checked = simulado.is_active !== false
    formPremium.checked = simulado.is_premium === true
    formSlug.readOnly = false
    examsSection.style.display = 'block'
    loadExamsIntoModal(simulado.id)
  } else {
    titleEl.textContent = 'Novo simulado'
    formTitle.value = ''
    formSlug.value = ''
    formPassing.value = 70
    formActive.checked = true
    formPremium.checked = false
    formSlug.readOnly = false
    examsSection.style.display = 'none'
    document.getElementById('exams-list-wrap').innerHTML = ''
  }
  document.getElementById('modal-simulado-backdrop').classList.add('open')
  formTitle.focus()
}

function closeModalSimulado () {
  document.getElementById('modal-simulado-backdrop').classList.remove('open')
  editingSimuladoId = null
  editingExams = []
}

async function loadExamsIntoModal (simuladoId) {
  const wrap = document.getElementById('exams-list-wrap')
  wrap.innerHTML = '<p class="admin-exams-empty">Carregando exames…</p>'
  const exams = await fetchExams(simuladoId)
  editingExams = exams
  renderExamsInModal()
}

function renderExamsInModal () {
  const wrap = document.getElementById('exams-list-wrap')
  if (editingExams.length === 0) {
    wrap.innerHTML = '<p class="admin-exams-empty">Nenhum exame. Adicione exames (ex.: 101, 102) para associar questões.</p>'
    return
  }
  wrap.innerHTML =
    '<table class="admin-exams-table">' +
    '<thead><tr><th>Código</th><th>Nome</th><th class="col-acoes">Ações</th></tr></thead><tbody>' +
    editingExams.map((e) =>
      '<tr data-exam-id="' + escapeHtml(e.id) + '">' +
      '<td><code>' + escapeHtml(e.code) + '</code></td>' +
      '<td>' + escapeHtml(e.name || '—') + '</td>' +
      '<td class="col-acoes">' +
      '<button type="button" class="btn-icon btn-edit-exam" title="Editar">✏️</button> ' +
      '<button type="button" class="btn-icon danger btn-delete-exam" title="Excluir">🗑️</button>' +
      '</td></tr>'
    ).join('') +
    '</tbody></table>'
  attachExamHandlers()
}

function attachExamHandlers () {
  const wrap = document.getElementById('exams-list-wrap')
  if (!wrap) return
  wrap.querySelectorAll('.btn-edit-exam').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr[data-exam-id]')
      const id = tr?.getAttribute('data-exam-id')
      const exam = editingExams.find((e) => e.id === id)
      if (exam) openModalExam(exam)
    })
  })
  wrap.querySelectorAll('.btn-delete-exam').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const tr = btn.closest('tr[data-exam-id]')
      const id = tr?.getAttribute('data-exam-id')
      const exam = editingExams.find((e) => e.id === id)
      if (!exam || !confirm('Excluir o exame "' + (exam.code || exam.name) + '"? Questões vinculadas podem ficar órfãs.')) return
      const res = await fetch(`/admin/api/exams/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error || 'Erro ao excluir exame.')
        return
      }
      if (editingSimuladoId) await loadExamsIntoModal(editingSimuladoId)
    })
  })
}

function openModalExam (exam = null) {
  editingExamId = exam?.id ?? null
  document.getElementById('modal-exam-title').textContent = exam ? 'Editar exame' : 'Adicionar exame'
  document.getElementById('form-exam-code').value = exam?.code ?? ''
  document.getElementById('form-exam-name').value = exam?.name ?? ''
  document.getElementById('form-exam-code').readOnly = !!exam
  document.getElementById('modal-exam-backdrop').classList.add('open')
  document.getElementById('form-exam-code').focus()
}

function closeModalExam () {
  document.getElementById('modal-exam-backdrop').classList.remove('open')
  editingExamId = null
}

async function saveSimulado () {
  const title = document.getElementById('form-simulado-title').value.trim()
  let slug = document.getElementById('form-simulado-slug').value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  if (!slug && title) slug = slugFromTitle(title)
  const passing = Math.min(100, Math.max(0, parseInt(document.getElementById('form-simulado-passing').value, 10) || 70))
  const is_active = document.getElementById('form-simulado-active').checked
  const is_premium = document.getElementById('form-simulado-premium').checked

  if (!title) {
    alert('Título é obrigatório.')
    return
  }
  if (slug.length < 2) {
    alert('Slug deve ter no mínimo 2 caracteres (apenas a-z, 0-9 e hífen).')
    return
  }

  const payload = { title, slug, passing_score: passing, is_active, is_premium }
  const id = editingSimuladoId
  const url = id ? `/admin/api/simulados/${encodeURIComponent(id)}` : '/admin/api/simulados'
  const method = id ? 'PUT' : 'POST'
  const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert(json.error || 'Erro ao salvar simulado.')
    return
  }
  closeModalSimulado()
  await loadSimulados()
}

async function saveExam () {
  const simuladoId = editingSimuladoId
  if (!simuladoId) return
  const code = document.getElementById('form-exam-code').value.trim()
  const name = document.getElementById('form-exam-name').value.trim()
  if (!code) {
    alert('Código do exame é obrigatório.')
    return
  }
  const id = editingExamId
  const url = id ? `/admin/api/exams/${encodeURIComponent(id)}` : '/admin/api/exams'
  const method = id ? 'PUT' : 'POST'
  const body = id ? { name: name || code } : { simulado_id: simuladoId, code, name: name || code }
  const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert(json.error || 'Erro ao salvar exame.')
    return
  }
  closeModalExam()
  await loadExamsIntoModal(simuladoId)
}

function attachRowHandlers () {
  const tbody = document.getElementById('simulados-tbody')
  if (!tbody) return
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button')
    if (!btn) return
    const tr = btn.closest('tr[data-id]')
    if (!tr) return
    const id = tr.getAttribute('data-id')
    const simulado = simulados.find((s) => s.id === id)
    if (!simulado) return
    if (btn.classList.contains('btn-edit') || btn.classList.contains('btn-exams')) {
      openModalSimulado(simulado)
    } else if (btn.classList.contains('btn-delete')) {
      if (!confirm('Excluir o simulado "' + (simulado.title || simulado.slug) + '"? Exames e questões vinculados podem ser afetados.')) return
      deleteSimulado(id)
    }
  })
}

async function deleteSimulado (id) {
  const res = await fetch(`/admin/api/simulados/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getAuthHeaders() })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert(json.error || 'Erro ao excluir simulado.')
    return
  }
  await loadSimulados()
}

async function init () {
  await ensureToken()
  if (!token) {
    window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin/simulados.html')
    return
  }

  await loadSimulados()

  document.getElementById('form-simulado-title').addEventListener('input', () => {
    if (!editingSimuladoId) {
      const slug = document.getElementById('form-simulado-slug')
      if (!slug.value || slug.value === slugFromTitle(document.getElementById('form-simulado-title').value)) {
        slug.value = slugFromTitle(document.getElementById('form-simulado-title').value)
      }
    }
  })

  document.getElementById('btn-novo-simulado').addEventListener('click', () => openModalSimulado(null))
  document.getElementById('modal-simulado-close').addEventListener('click', closeModalSimulado)
  document.getElementById('modal-simulado-cancel').addEventListener('click', closeModalSimulado)
  document.getElementById('modal-simulado-save').addEventListener('click', saveSimulado)

  document.getElementById('btn-add-exam').addEventListener('click', () => openModalExam(null))
  document.getElementById('modal-exam-close').addEventListener('click', closeModalExam)
  document.getElementById('modal-exam-cancel').addEventListener('click', closeModalExam)
  document.getElementById('modal-exam-save').addEventListener('click', saveExam)

  document.getElementById('modal-simulado-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-simulado-backdrop') closeModalSimulado()
  })
  document.getElementById('modal-exam-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-exam-backdrop') closeModalExam()
  })

  document.getElementById('admin-sidebar-sair').addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/login.html'
  })
}

init().catch((e) => {
  console.error('[admin-simulados] Erro ao inicializar:', e)
})
