# Modelo de dados (Supabase)

Este documento descreve as tabelas utilizadas pela aplicação no Supabase (PostgreSQL). Não contém dados reais, credenciais ou informações sensíveis — apenas nomes de tabelas, colunas relevantes e propósito.

---

## Visão geral

- **Auth:** Gerenciado pelo Supabase Auth (tabela interna `auth.users`). A aplicação usa Auth para login (OAuth Google) e para identificar o usuário pelo token JWT.
- **Tabelas da aplicação:** Todas no schema `public`, acessadas via PostgREST (Supabase client). Recomenda-se configurar Row Level Security (RLS) conforme as políticas de acesso desejadas.

---

## Tabelas

### `users`

- **Propósito:** Perfil e metadados do usuário (espelho/estendido do Auth). Usado para listar usuários no admin, definir role (admin) e plan (free/pro).
- **Colunas principais (referência):** `id` (UUID, PK, igual ao `auth.users.id`), `email`, `name`, `role` (ex.: `'admin'` ou null), `plan` (ex.: `'free'`, `'pro'`), `last_login_at`, `created_at`, etc.
- **Uso:** Sincronizado/upsert na primeira sessão (track-login) e na listagem de usuários no admin; atualizado pelo painel (role/plan).

### `access_log`

- **Propósito:** Registro de acessos (login) para auditoria ou analytics.
- **Colunas principais (referência):** `user_id`, `email`, `logged_at`, etc.
- **Uso:** Inserção no primeiro login (track-login no front).

### `sessions`

- **Propósito:** Sessões de simulado (progresso): resultado por sessão de prova (simulado, exame, pontuação, tempo, etc.).
- **Colunas principais (referência):** identificador do usuário, referência ao simulado/exame, dados da sessão (ex.: score, tempo, respostas), timestamps.
- **Uso:** Leitura/escrita pelo front (com RLS) e pelo servidor quando necessário; listagem no “Meu Progresso”.

### `simulados`

- **Propósito:** Cadastro de simulados (ex.: LPIC-1, LPIC-2).
- **Colunas principais (referência):** `id`, `slug`, `title`, `is_active`, `is_premium`, `passing_score`, `created_at`, etc.
- **Uso:** API pública (lista ativos) e admin (CRUD).

### `exams`

- **Propósito:** Exames de cada simulado (ex.: 101, 102 para LPIC-1).
- **Colunas principais (referência):** `id`, `simulado_id` (FK), `code` (ex.: `'101'`, `'102'`), etc.
- **Uso:** Admin (CRUD); API de questões filtra por `simulado_id` e opcionalmente por `exam` (code).

### `questions`

- **Propósito:** Questões de múltipla escolha ou texto, vinculadas a um exame.
- **Colunas principais (referência):** `id`, `exam_id` (FK), `type` (ex.: `'multiple'`, `'text'`), `question`, `options`, `answer`, `difficulty`, `hint`, `is_active`, etc.
- **Uso:** API pública (questões ativas por simulado/exame); admin (CRUD e import em lote).

### `articles`

- **Propósito:** Artigos/publicações (blog ou recursos).
- **Colunas principais (referência):** `id`, `title`, `slug`, `excerpt`, `content`, `content_type`, `author_name`, `published_at`, `is_published`, `cover_image_url`, etc.
- **Uso:** API pública (listagem e por slug); admin (CRUD); upload de imagens em disco ou Supabase Storage (capas), URL salva no conteúdo ou em `cover_image_url`; importação de .md (um ou vários arquivos) com frontmatter opcional.

### `useful_links`

- **Propósito:** Links úteis (nome, URL, descrição, rótulo, ícone, ordem).
- **Colunas principais (referência):** `id` (UUID), `name`, `url`, `description`, `label`, `icon_url`, `sort_order`, `created_at`, etc.
- **Uso:** API pública (listagem); admin (CRUD e upload de ícone).

---

## Relacionamentos (resumo)

- `exams.simulado_id` → `simulados.id`
- `questions.exam_id` → `exams.id`
- `sessions` referencia usuário e simulado/exame conforme o esquema definido no banco
- `users.id` corresponde a `auth.users.id`

---

## Segurança no Supabase

- **RLS:** Deve ser habilitado nas tabelas conforme a política desejada (ex.: usuário autenticado lê/escreve apenas seus próprios dados em `sessions`; leitura pública apenas para tabelas/colunas expostas pela API pública).
- **Service role:** Usada pelo servidor apenas para operações que precisam contornar RLS (ex.: listar todos os usuários Auth, stats, sync de usuários, exames). Nunca exposta ao frontend.

Este documento não inclui dados reais, apenas a estrutura e o propósito das tabelas.
