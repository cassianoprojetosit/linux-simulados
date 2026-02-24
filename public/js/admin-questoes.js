/**
 * Página Admin Questões: filtros, tabela, modal criar/editar, import JSON, paginação.
 * Depende de admin-auth.js (sessão + ping). Obtém token próprio para as chamadas da API.
 */
import { supabase } from '/js/supabase-auth.js'

const LIMIT = 20
let token = null
let simulados = []
let exams = []
let currentPage = 1
let totalCount = 0
let editingId = null
let validatedImport = null
let importFileData = null // { questions: [] } quando o usuário seleciona um arquivo
let lastQuestoesList = []

function escapeHtml(text) {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

function getAuthHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

function resumo(str, max = 80) {
  if (!str) return '—'
  const s = String(str).trim()
  return s.length <= max ? s : s.slice(0, max) + '…'
}

function simuladoLabel(s) {
  return s?.title || s?.name || s?.slug || s?.id || '—'
}

async function ensureToken() {
  if (token) return
  const { data } = await supabase.auth.getSession()
  token = data?.session?.access_token ?? null
}

async function fetchSimulados() {
  const res = await fetch('/admin/api/simulados', { headers: getAuthHeaders() })
  if (!res.ok) return []
  const json = await res.json()
  return json.data || []
}

async function fetchExams(simuladoId) {
  if (!simuladoId) return []
  const url = `/admin/api/exams?simulado_id=${encodeURIComponent(simuladoId)}`
  const res = await fetch(url, { headers: getAuthHeaders() })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[admin-questoes] fetchExams falhou:', res.status, json.error || res.statusText)
    if (json.error) alert('Erro ao carregar exames: ' + json.error)
    return []
  }
  return json.data || []
}

function buildQuestoesParams() {
  const params = new URLSearchParams()
  params.set('page', String(currentPage))
  params.set('limit', String(LIMIT))
  const searchVal = (document.getElementById('filter-search')?.value || '').trim()
  const simuladoId = document.getElementById('filter-simulado')?.value
  const examValue = document.getElementById('filter-exam')?.value
  const type = document.getElementById('filter-type')?.value
  const difficulty = document.getElementById('filter-difficulty')?.value
  const status = document.getElementById('filter-status')?.value
  if (searchVal) params.set('q', searchVal)
  if (simuladoId) params.set('simulado', simuladoId)
  if (examValue) params.set('exam', examValue)
  if (type) params.set('type', type)
  if (difficulty) params.set('difficulty', difficulty)
  if (status) params.set('status', status)
  return params
}

async function loadQuestoes() {
  const tbody = document.getElementById('questoes-tbody')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--text-muted);text-align:center;">Carregando…</td></tr>'
  const params = buildQuestoesParams()
  const res = await fetch(`/admin/api/questoes?${params}`, { headers: getAuthHeaders() })
  if (!res.ok) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--red);">Erro ao carregar questões.</td></tr>'
    return
  }
  const json = await res.json()
  const list = json.data || []
  totalCount = json.total ?? 0
  lastQuestoesList = list

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="padding:24px;color:var(--text-muted);">Nenhuma questão encontrada.</td></tr>'
  } else {
    tbody.innerHTML = list.map((q, i) => {
      const num = (currentPage - 1) * LIMIT + i + 1
      const pergunta = resumo(q.question, 80)
      const tipo = q.type === 'text' ? 'Digitação' : 'Múltipla escolha'
      const diff = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }[q.difficulty] || q.difficulty
      const statusClass = q.is_active ? 'ativa' : 'inativa'
      const statusText = q.is_active ? 'Ativa' : 'Inativa'
      const examCode = q.exams?.code || '—'
      return (
        '<tr data-id="' + escapeHtml(q.id) + '">' +
        '<td class="col-num">' + num + '</td>' +
        '<td class="col-pergunta" title="' + escapeHtml(q.question || '') + '">' + escapeHtml(pergunta) + '</td>' +
        '<td>' + escapeHtml(tipo) + '</td>' +
        '<td>' + escapeHtml(diff) + '</td>' +
        '<td><span class="admin-badge ' + statusClass + '">' + statusText + '</span></td>' +
        '<td class="col-acoes">' +
        '<button type="button" class="btn-icon btn-edit" title="Editar">✏️</button> ' +
        (q.is_active
          ? '<button type="button" class="btn-icon btn-deactivate" title="Desativar">🔴</button> '
          : '<button type="button" class="btn-icon btn-activate" title="Ativar">🟢</button> ') +
        '<button type="button" class="btn-icon danger btn-delete" title="Excluir">🗑️</button>' +
        '</td></tr>'
      )
    }).join('')
  }

  document.getElementById('pagination-info').textContent =
    totalCount === 0 ? 'Nenhuma questão' : `${(currentPage - 1) * LIMIT + 1}–${Math.min(currentPage * LIMIT, totalCount)} de ${totalCount}`
  document.getElementById('btn-prev').disabled = currentPage <= 1
  document.getElementById('btn-next').disabled = currentPage * LIMIT >= totalCount

}

function openEditFromList(id) {
  const q = lastQuestoesList.find(x => x.id === id)
  if (!q) return
  editingId = id
  document.getElementById('modal-questao-title').textContent = 'Editar Questão'
  document.getElementById('form-question').value = q.question || ''
  document.getElementById('form-type').value = q.type || 'multiple'
  document.getElementById('form-difficulty').value = q.difficulty || 'medium'
  document.getElementById('form-hint').value = q.hint || ''
  if (q.type === 'text') {
    document.getElementById('form-answer-text').value = (Array.isArray(q.answer) ? q.answer[0] : q.answer) || ''
  } else {
    const opts = q.options || []
    document.getElementById('form-opt-a').value = opts[0] || ''
    document.getElementById('form-opt-b').value = opts[1] || ''
    document.getElementById('form-opt-c').value = opts[2] || ''
    document.getElementById('form-opt-d').value = opts[3] || ''
    document.getElementById('form-opt-e').value = opts[4] || ''
    const ans = Array.isArray(q.answer) ? q.answer[0] : q.answer
    const idx = opts.indexOf(ans)
    const radio = document.querySelector(`input[name="form-correct"][value="${Math.max(0, idx)}"]`)
    if (radio) radio.checked = true
  }
  document.getElementById('form-multiple-wrap').style.display = q.type === 'multiple' ? 'block' : 'none'
  document.getElementById('form-text-wrap').style.display = q.type === 'text' ? 'block' : 'none'
  const simuladoId = q.exams?.simulado_id || (q.exams?.simulados?.id)
  document.getElementById('form-simulado').value = simuladoId || ''
  fetchExams(simuladoId || '').then(exs => {
    fillExamsSelect(document.getElementById('form-exam'), exs, q.exam_id)
  })
  document.getElementById('modal-questao-backdrop').classList.add('open')
}


function fillSimuladoSelect(select, selectedId) {
  if (!select) return
  select.innerHTML = '<option value="">' + (select.id === 'filter-simulado' ? 'Todos os simulados' : 'Selecione') + '</option>' +
    simulados.map(s => '<option value="' + escapeHtml(s.id) + '"' + (s.id === selectedId ? ' selected' : '') + '>' + escapeHtml(simuladoLabel(s)) + '</option>').join('')
}

function fillExamsSelect(select, list, selectedValue, useCodeAsValue) {
  if (!select) return
  const isFilter = select.id === 'filter-exam'
  const listArr = Array.isArray(list) ? list : []
  const placeholder = isFilter
    ? (listArr.length === 0 ? 'Nenhum exame (cadastre em Simulados)' : 'Todos os exames')
    : 'Selecione o simulado primeiro'
  const valueKey = useCodeAsValue || isFilter ? 'code' : 'id'
  select.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>' +
    listArr.map(e => {
      const val = valueKey === 'code' ? (e.code || e.id) : e.id
      const label = (e.code || '') + (e.name ? ' — ' + e.name : '')
      const selected = (valueKey === 'code' ? val === selectedValue : e.id === selectedValue) ? ' selected' : ''
      return '<option value="' + escapeHtml(val) + '"' + selected + '>' + escapeHtml(label || val) + '</option>'
    }).join('')
}

function openNewQuestao() {
  editingId = null
  document.getElementById('modal-questao-title').textContent = 'Nova Questão'
  document.getElementById('form-simulado').value = ''
  document.getElementById('form-exam').innerHTML = '<option value="">Selecione o simulado primeiro</option>'
  document.getElementById('form-type').value = 'multiple'
  document.getElementById('form-difficulty').value = 'medium'
  document.getElementById('form-question').value = ''
  document.getElementById('form-opt-a').value = ''
  document.getElementById('form-opt-b').value = ''
  document.getElementById('form-opt-c').value = ''
  document.getElementById('form-opt-d').value = ''
  document.getElementById('form-opt-e').value = ''
  document.querySelectorAll('input[name="form-correct"]').forEach(r => { r.checked = false })
  document.getElementById('form-answer-text').value = ''
  document.getElementById('form-hint').value = ''
  document.getElementById('form-explanation').value = ''
  document.getElementById('form-multiple-wrap').style.display = 'block'
  document.getElementById('form-text-wrap').style.display = 'none'
  document.getElementById('modal-questao-backdrop').classList.add('open')
}

function closeModalQuestao() {
  document.getElementById('modal-questao-backdrop').classList.remove('open')
  editingId = null
}

function toggleTypeVisibility() {
  const type = document.getElementById('form-type').value
  document.getElementById('form-multiple-wrap').style.display = type === 'multiple' ? 'block' : 'none'
  document.getElementById('form-text-wrap').style.display = type === 'text' ? 'block' : 'none'
}

async function saveQuestao() {
  const examId = document.getElementById('form-exam').value
  const type = document.getElementById('form-type').value
  const question = document.getElementById('form-question').value?.trim()
  if (!examId || !question) {
    alert('Preencha Simulado, Exame e Pergunta.')
    return
  }
  let options = null
  let correct = 0
  let answer = ['?']
  if (type === 'multiple') {
    options = [
      document.getElementById('form-opt-a').value?.trim(),
      document.getElementById('form-opt-b').value?.trim(),
      document.getElementById('form-opt-c').value?.trim(),
      document.getElementById('form-opt-d').value?.trim()
    ]
    const eVal = document.getElementById('form-opt-e').value?.trim()
    if (eVal) options.push(eVal)
    const cr = document.querySelector('input[name="form-correct"]:checked')
    correct = cr ? parseInt(cr.value, 10) : 0
    const opt = options[correct]
    answer = opt != null ? [opt] : ['?']
  } else {
    const at = document.getElementById('form-answer-text').value?.trim()
    answer = at ? [at] : ['?']
  }
  const payload = {
    exam_id: examId,
    type,
    question,
    options: type === 'multiple' ? options : null,
    correct: type === 'multiple' ? correct : undefined,
    answer: type === 'text' ? answer : undefined,
    difficulty: document.getElementById('form-difficulty').value || 'medium',
    hint: document.getElementById('form-hint').value?.trim() || null,
    is_active: true
  }
  if (type === 'multiple') payload.options = options
  if (type === 'multiple') payload.correct = correct
  else payload.answer = answer

  const url = editingId ? `/admin/api/questoes/${editingId}` : '/admin/api/questoes'
  const method = editingId ? 'PUT' : 'POST'
  if (editingId) {
    delete payload.correct
    if (type === 'multiple') payload.answer = answer
  }
  const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(payload) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    alert(err.error || 'Erro ao salvar.')
    return
  }
  closeModalQuestao()
  loadQuestoes()
}

async function toggleActive(id, active) {
  if (!id) return
  const res = await fetch(`/admin/api/questoes/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_active: active })
  })
  if (!res.ok) { alert('Erro ao atualizar.'); return }
  loadQuestoes()
}

async function confirmDelete(id) {
  if (!id) return
  if (!confirm('Excluir esta questão permanentemente? Esta ação não pode ser desfeita.')) return
  const res = await fetch(`/admin/api/questoes/${id}?hard=true`, { method: 'DELETE', headers: getAuthHeaders() })
  if (!res.ok) { alert('Erro ao excluir.'); return }
  loadQuestoes()
}

function openImportModal() {
  validatedImport = null
  importFileData = null
  document.getElementById('import-json').value = ''
  document.getElementById('import-simulado').value = ''
  document.getElementById('import-exam').innerHTML = '<option value="">Selecione o simulado primeiro</option>'
  document.getElementById('import-file').value = ''
  const fileStatus = document.getElementById('import-file-status')
  if (fileStatus) fileStatus.textContent = ''
  document.getElementById('import-preview-wrap').style.display = 'none'
  document.getElementById('import-confirmar').style.display = 'none'
  fillSimuladoSelect(document.getElementById('import-simulado'), null)
  document.getElementById('modal-import-backdrop').classList.add('open')
}

function closeImportModal() {
  document.getElementById('modal-import-backdrop').classList.remove('open')
  validatedImport = null
  importFileData = null
}

function onImportFileChange(e) {
  const input = e.target
  const file = input?.files?.[0]
  const statusEl = document.getElementById('import-file-status')
  if (!statusEl) return
  importFileData = null
  if (!file) {
    statusEl.textContent = ''
    return
  }
  if (!file.name.toLowerCase().endsWith('.json')) {
    statusEl.textContent = 'Use um arquivo .json'
    statusEl.style.color = 'var(--red)'
    return
  }
  statusEl.textContent = 'Lendo arquivo…'
  statusEl.style.color = ''
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const raw = reader.result
      const parsed = JSON.parse(raw)
      const arr = normalizarQuestoesImport(parsed)
      importFileData = { questions: arr }
      statusEl.textContent = `Arquivo "${file.name}" carregado: ${arr.length} questão(s). Selecione o simulado e clique em Validar.`
      statusEl.style.color = 'var(--accent)'
      document.getElementById('import-json').value = ''
    } catch (err) {
      importFileData = null
      statusEl.textContent = 'JSON inválido no arquivo. Verifique a sintaxe.'
      statusEl.style.color = 'var(--red)'
    }
  }
  reader.onerror = () => {
    importFileData = null
    statusEl.textContent = 'Erro ao ler o arquivo.'
    statusEl.style.color = 'var(--red)'
  }
  reader.readAsText(file, 'UTF-8')
}

function normalizarQuestoesImport(parsed) {
  if (Array.isArray(parsed)) return parsed
  if (parsed && Array.isArray(parsed.questions)) return parsed.questions
  if (parsed && parsed.question) return [parsed]
  return []
}

function validarImport() {
  const simuladoId = document.getElementById('import-simulado').value
  const examId = document.getElementById('import-exam').value
  if (!simuladoId) {
    alert('Selecione o simulado de destino.')
    return
  }
  if (!examId) {
    alert('Selecione o exame de destino. Todas as questões serão vinculadas a esse exame.')
    return
  }
  let arr = []
  if (importFileData && importFileData.questions && importFileData.questions.length) {
    arr = importFileData.questions
  } else {
    const raw = document.getElementById('import-json').value?.trim()
    if (!raw) {
      alert('Selecione um arquivo JSON ou cole o conteúdo no campo de texto.')
      return
    }
    try {
      const parsed = JSON.parse(raw)
      arr = normalizarQuestoesImport(parsed)
    } catch (e) {
      alert('JSON inválido. Verifique a sintaxe (vírgulas, aspas).')
      return
    }
  }
  if (arr.length === 0) {
    alert('Nenhuma questão encontrada no JSON. Use um array de objetos com "question", "options" (múltipla) e "correct" ou "answer". Não é necessário incluir "exam" — o exame é o que você escolheu.')
    return
  }
  validatedImport = { simulado_id: simuladoId, exam_id: examId, questions: arr }
  document.getElementById('import-preview-wrap').style.display = 'block'
  document.getElementById('import-preview-text').textContent = `Serão importadas ${arr.length} questão(s) no exame selecionado. Clique em "Sim, importar" para confirmar.`
  document.getElementById('import-count').textContent = arr.length
  document.getElementById('import-confirmar').style.display = 'inline-block'
}

async function confirmarImport() {
  if (!validatedImport || !validatedImport.questions.length) return
  const count = validatedImport.questions.length
  const msg = `Tem certeza que deseja importar ${count} questão(s) no exame selecionado? Esta ação adiciona as questões ao banco.`
  if (!confirm(msg)) return
  const res = await fetch('/admin/api/questoes/import', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(validatedImport)
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const hint = json.hint ? `\n\n${json.hint}` : ''
    alert((json.error || 'Erro ao importar.') + hint)
    return
  }
  alert(`Importadas ${json.imported ?? 0} questões.`)
  closeImportModal()
  loadQuestoes()
}

async function init() {
  await ensureToken()
  if (!token) return

  simulados = await fetchSimulados()
  fillSimuladoSelect(document.getElementById('filter-simulado'))
  fillSimuladoSelect(document.getElementById('form-simulado'))
  fillSimuladoSelect(document.getElementById('import-simulado'))

  async function loadExamsForFilterSimulado() {
    const selectSimulado = document.getElementById('filter-simulado')
    const filterExamEl = document.getElementById('filter-exam')
    if (!selectSimulado || !filterExamEl) return
    const id = (selectSimulado.value || '').trim()
    if (!id) {
      filterExamEl.innerHTML = '<option value="">Todos os exames</option>'
      return
    }
    filterExamEl.innerHTML = '<option value="">Carregando exames…</option>'
    filterExamEl.disabled = true
    exams = await fetchExams(id)
    filterExamEl.disabled = false
    fillExamsSelect(filterExamEl, exams, null, true)
  }

  document.getElementById('filter-simulado').addEventListener('change', loadExamsForFilterSimulado)
  await loadExamsForFilterSimulado()

  document.getElementById('form-simulado').addEventListener('change', async () => {
    const id = document.getElementById('form-simulado').value
    const formExamEl = document.getElementById('form-exam')
    if (!id) {
      formExamEl.innerHTML = '<option value="">Selecione o simulado primeiro</option>'
      return
    }
    const exs = await fetchExams(id)
    fillExamsSelect(formExamEl, exs, null, false)
  })

  document.getElementById('btn-aplicar-filtros').addEventListener('click', () => { currentPage = 1; loadQuestoes() })

  // Busca com debounce (desempenho: evita requisição a cada tecla)
  let searchDebounce = null
  document.getElementById('filter-search')?.addEventListener('input', () => {
    if (searchDebounce) clearTimeout(searchDebounce)
    searchDebounce = setTimeout(() => {
      searchDebounce = null
      currentPage = 1
      loadQuestoes()
    }, 350)
  })
  document.getElementById('filter-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (searchDebounce) clearTimeout(searchDebounce)
      searchDebounce = null
      currentPage = 1
      loadQuestoes()
    }
  })

  document.getElementById('btn-nova-questao').addEventListener('click', openNewQuestao)
  document.getElementById('btn-importar-json').addEventListener('click', openImportModal)
  document.getElementById('btn-prev').addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadQuestoes() } })
  document.getElementById('btn-next').addEventListener('click', () => { if (currentPage * LIMIT < totalCount) { currentPage++; loadQuestoes() } })

  document.getElementById('form-type').addEventListener('change', toggleTypeVisibility)
  document.getElementById('modal-questao-close').addEventListener('click', closeModalQuestao)
  document.getElementById('modal-questao-cancel').addEventListener('click', closeModalQuestao)
  document.getElementById('modal-questao-save').addEventListener('click', saveQuestao)
  document.getElementById('modal-questao-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-questao-backdrop') closeModalQuestao() })

  document.getElementById('import-simulado').addEventListener('change', async () => {
    const id = document.getElementById('import-simulado').value
    const el = document.getElementById('import-exam')
    if (!id) {
      el.innerHTML = '<option value="">Selecione o simulado primeiro</option>'
      return
    }
    el.innerHTML = '<option value="">Carregando…</option>'
    el.disabled = true
    const exs = await fetchExams(id)
    el.disabled = false
    fillExamsSelect(el, exs, null, false)
  })

  document.getElementById('modal-import-close').addEventListener('click', closeImportModal)
  document.getElementById('modal-import-cancel').addEventListener('click', closeImportModal)
  document.getElementById('import-file').addEventListener('change', onImportFileChange)
  document.getElementById('import-validar').addEventListener('click', validarImport)
  document.getElementById('import-confirmar').addEventListener('click', confirmarImport)
  document.getElementById('modal-import-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-import-backdrop') closeImportModal() })

  document.getElementById('questoes-tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]')
    if (!tr) return
    const id = tr.dataset.id
    if (e.target.classList.contains('btn-edit')) openEditFromList(id)
    else if (e.target.classList.contains('btn-deactivate')) toggleActive(id, false)
    else if (e.target.classList.contains('btn-activate')) toggleActive(id, true)
    else if (e.target.classList.contains('btn-delete')) confirmDelete(id)
  })

  await loadQuestoes()
}

init()
