import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SECRET_KEY) para rodar o backup.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function main () {
  const baseDir = resolve(process.cwd(), 'backups', 'questions')
  mkdirSync(baseDir, { recursive: true })

  const { data: simulados, error: simErr } = await supabase
    .from('simulados')
    .select('id, slug, title')
    .order('slug', { ascending: true })

  if (simErr) {
    console.error('Erro ao buscar simulados:', simErr.message)
    process.exit(1)
  }

  const { data: exams, error: exErr } = await supabase
    .from('exams')
    .select('id, simulado_id, code')
    .order('code', { ascending: true })

  if (exErr) {
    console.error('Erro ao buscar exames:', exErr.message)
    process.exit(1)
  }

  const examsBySimulado = new Map()
  for (const ex of exams || []) {
    if (!examsBySimulado.has(ex.simulado_id)) examsBySimulado.set(ex.simulado_id, [])
    examsBySimulado.get(ex.simulado_id).push(ex)
  }

  let totalQuestions = 0

  for (const sim of simulados || []) {
    const simExams = examsBySimulado.get(sim.id) || []
    for (const ex of simExams) {
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', ex.id)
        .order('id', { ascending: true })

      if (qErr) {
        console.error(`Erro ao buscar questões para simulado=${sim.slug} exame=${ex.code}:`, qErr.message)
        continue
      }

      const safeSlug = (sim.slug || `simulado-${sim.id}`).replace(/[^a-z0-9-]/gi, '_')
      const code = (ex.code || 'exam').toString().replace(/[^a-z0-9-]/gi, '_')
      const filePath = resolve(baseDir, `${safeSlug}__exam-${code}.json`)

      writeFileSync(filePath, JSON.stringify({
        meta: {
          simulado_id: sim.id,
          simulado_slug: sim.slug,
          simulado_title: sim.title,
          exam_id: ex.id,
          exam_code: ex.code,
          exam_name: null,
          exported_at: new Date().toISOString()
        },
        questions: questions || []
      }, null, 2), 'utf8')

      totalQuestions += (questions || []).length
      console.log(`Backup: ${filePath} (${(questions || []).length} questões)`)
    }
  }

  console.log(`Backup concluído. Total de questões exportadas: ${totalQuestions}.`)
}

main().catch((e) => {
  console.error('Falha no backup:', e)
  process.exit(1)
})

