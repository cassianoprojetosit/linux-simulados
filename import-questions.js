import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env (use .env.example como referência).')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const html = readFileSync('./public/simulado-lpic1.html', 'utf-8')

// Extrair os blocos JSON embutidos no HTML
function extractJSON(html, id) {
  const regex = new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`)
  const match = html.match(regex)
  if (!match) throw new Error(`Bloco ${id} não encontrado no HTML`)
  const parsed = JSON.parse(match[1].trim())
  return parsed.questions || parsed
}

async function importQuestions() {
  console.log('🔍 Extraindo questões do HTML...')

  let questions101 = []
  let questions102 = []

  try {
    questions101 = extractJSON(html, 'data-101')
    console.log(`✅ Exame 101: ${questions101.length} questões encontradas`)
    console.log('📋 Exemplo questão 101:')
    console.log(JSON.stringify(questions101[0], null, 2))
  } catch (e) {
    console.error('❌ Erro ao extrair data-101:', e.message)
    process.exit(1)
  }

  try {
    questions102 = extractJSON(html, 'data-102')
    console.log(`\n✅ Exame 102: ${questions102.length} questões encontradas`)
    console.log('📋 Exemplo questão 102:')
    console.log(JSON.stringify(questions102[0], null, 2))
  } catch (e) {
    console.error('❌ Erro ao extrair data-102:', e.message)
    process.exit(1)
  }

  // Buscar IDs dos exames no banco
  console.log('\n🔍 Buscando exames no banco...')
  const { data: exams, error: examsError } = await supabase
    .from('exams')
    .select('id, code')

  if (examsError) {
    console.error('❌ Erro ao buscar exames:', examsError.message)
    process.exit(1)
  }

  const exam101 = exams.find(e => e.code === '101')
  const exam102 = exams.find(e => e.code === '102')

  if (!exam101 || !exam102) {
    console.error('❌ Exames não encontrados. Execute o Passo 3B primeiro.')
    process.exit(1)
  }

  console.log(`✅ Exam 101 ID: ${exam101.id}`)
  console.log(`✅ Exam 102 ID: ${exam102.id}`)

  // Formatar questões para o banco
  function formatQuestions(questions, examId) {
    return questions.map(q => {
      let answer = []
  
      if (q.type === 'multiple' && q.options && q.correct !== undefined) {
        // correct é o índice da opção correta
        const correctOption = q.options[q.correct]
        answer = correctOption ? [correctOption] : ['?']
      } else if (q.type === 'text' && q.answer) {
        // questões de texto têm campo answer diretamente
        answer = Array.isArray(q.answer) ? q.answer : [q.answer]
        answer = answer.filter(a => a !== null && a !== undefined && a !== '')
        if (answer.length === 0) answer = ['?']
      } else {
        answer = ['?']
      }
  
      return {
        exam_id: examId,
        type: q.type || 'multiple',
        question: q.question,
        options: q.options || null,
        answer: answer,
        topic: q.topic || null,
        difficulty: q.difficulty || 'medium',
        hint: q.hint || null,
        is_active: true
      }
    })
  }

  const formatted101 = formatQuestions(questions101, exam101.id)
  const formatted102 = formatQuestions(questions102, exam102.id)

  console.log('\n📋 Exemplo formatado para o banco:')
  console.log(JSON.stringify(formatted101[0], null, 2))

  const allQuestions = [...formatted101, ...formatted102]

  console.log(`\n📦 Total a importar: ${allQuestions.length} questões`)
  console.log('⏳ Importando...')

  // Inserir em lotes de 50
  const batchSize = 50
  let inserted = 0

  for (let i = 0; i < allQuestions.length; i += batchSize) {
    const batch = allQuestions.slice(i, i + batchSize)
    const { error } = await supabase.from('questions').insert(batch)

    if (error) {
      console.error(`❌ Erro no lote ${i}-${i + batchSize}:`, error.message)
      console.error('Primeiro item do lote:', JSON.stringify(batch[0], null, 2))
      process.exit(1)
    }

    inserted += batch.length
    console.log(`✅ ${inserted}/${allQuestions.length} questões importadas`)
  }

  console.log('\n🎉 Importação concluída com sucesso!')

  // Verificar no banco
  const { count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Total no banco: ${count} questões`)
}

importQuestions()
