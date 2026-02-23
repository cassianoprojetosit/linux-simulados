-- ============================================================
-- Adaptar a tabela EXISTENTE public.sessions para a integração
-- (Meu Progresso / resultados de simulados)
-- Sua tabela já tem: id (uuid), user_id, simulado_id, exam_code, mode, score, total, correct, wrong
-- Adicionamos as colunas que faltam e a política de DELETE.
-- ============================================================

-- Corrigir FK: user_id deve referenciar auth.users (login Google), não public.users
alter table public.sessions drop constraint if exists sessions_user_id_fkey;
alter table public.sessions
  add constraint sessions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

-- Colunas que o app envia e que não existem na sua tabela:
alter table public.sessions
  add column if not exists date text,
  add column if not exists date_timestamp bigint,
  add column if not exists duration int,
  add column if not exists passed boolean,
  add column if not exists topics_stats jsonb,
  add column if not exists weak_topics jsonb,
  add column if not exists simulado text,
  add column if not exists simulado_label text,
  add column if not exists exam text;

-- Índice para listar sessões do usuário por data (opcional, melhora performance)
create index if not exists idx_sessions_user_date_ts
  on public.sessions (user_id, date_timestamp desc nulls last);

-- Política para usuário poder APAGAR só as próprias sessões (Meu Progresso → botão excluir)
drop policy if exists "Usuário apaga própria sessão" on public.sessions;
create policy "Usuário apaga própria sessão"
  on public.sessions
  for delete
  using (auth.uid() = user_id);

-- Conferir: listar colunas após alteração
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'sessions' order by ordinal_position;
