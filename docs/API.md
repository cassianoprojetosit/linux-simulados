# Referência da API

Todas as respostas são JSON. Em caso de erro, o corpo segue o formato `{ "success": false, "error": "mensagem" }` (ou apenas `{ "error": "..." }` onde aplicável). Códigos HTTP seguem as convenções REST.

Nenhuma credencial ou dado sensível é documentado aqui; a configuração é feita via variáveis de ambiente no servidor.

---

## Autenticação nas rotas admin

Todas as rotas sob `/admin/api/*` exigem:

- Header: `Authorization: Bearer <access_token>`
- O token é o `access_token` da sessão Supabase Auth do usuário.
- O servidor valida o token e verifica se o usuário é admin (e-mail em `ADMIN_EMAIL` ou `role = 'admin'` na tabela `users`). Caso contrário: 401 ou 403.

---

## Rate limit

- Aplicado a todas as rotas da API (incluindo `/api/config`).
- Admin: limite por minuto definido no servidor (ex.: 40 req/min por IP).
- Demais APIs: limite por minuto definido no servidor (ex.: 120 req/min por IP).
- Em excesso: resposta `429` com `Retry-After: 60`.

---

## Rotas públicas (sem Bearer obrigatório)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/config` | Retorna `supabaseUrl` e `supabaseAnonKey` para o frontend inicializar o cliente Supabase. |
| GET | `/api/artigos` | Lista artigos publicados (campos: id, title, slug, excerpt, author_name, published_at, cover_image_url, content_type). |
| GET | `/api/artigos/:slug` | Um artigo por slug (campos incluindo content). Slug sanitizado e limitado no servidor. |
| GET | `/api/links` | Lista links úteis (id, name, url, description, label, icon_url, sort_order). |
| GET | `/api/simulados` | Lista simulados ativos (id, slug, title, is_active, is_premium, passing_score). |
| GET | `/api/simulados/:slug/questions` | Questões ativas do simulado. Query: `exam` (opcional, ex.: 101, 102, mixed). Slug e exam sanitizados. |

---

## Rotas do painel admin (`/admin/api/*`)

Todas exigem `Authorization: Bearer <token>` e usuário admin.

### Ping e identidade

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/ping` | Teste de conectividade e auth; retorna mensagem e e-mail do admin. |
| GET | `/admin/api/me` | Confirma se o usuário é admin; retorna `success`, `isAdmin`, `email`. Usado pelo front para exibir o link do painel. |

### Estatísticas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/stats` | Totais de usuários (free/pro), sessões e últimos usuários. Depende de `SUPABASE_SERVICE_ROLE_KEY` para números precisos do Auth. |

### Usuários

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/users` | Lista usuários. Query: `search`, `page`, `limit`. |
| PUT | `/admin/api/users/:id` | Atualiza usuário. Body: `role` (admin ou null), `plan` (free ou pro). Whitelist aplicada. |
| DELETE | `/admin/api/users/:id` | Remove metadados do usuário em `public.users` (não altera Auth). |

### Simulados

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/simulados` | Lista simulados. |
| POST | `/admin/api/simulados` | Cria simulado. Body: slug, title, is_active, is_premium, passing_score. |
| PUT | `/admin/api/simulados/:id` | Atualiza simulado (campos permitidos no body). |
| DELETE | `/admin/api/simulados/:id` | Remove simulado. |

### Exames (por simulado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/exams` | Lista exames. Query: `simulado_id` (obrigatório). Requer service role. |
| POST | `/admin/api/exams` | Cria exame. Body: simulado_id, code. |
| PUT | `/admin/api/exams/:id` | Atualiza exame (ex.: code). |
| DELETE | `/admin/api/exams/:id` | Remove exame. |

### Questões

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/questoes` | Lista questões com filtros. Query: page, limit, simulado, exam, type, difficulty, status, q/search. |
| POST | `/admin/api/questoes` | Cria questão. Body com whitelist de colunas. |
| POST | `/admin/api/questoes/import` | Importação em lote. Body: simulado_id, questions (array). |
| PUT | `/admin/api/questoes/:id` | Atualiza questão (whitelist). |
| DELETE | `/admin/api/questoes/:id` | Desativa ou remove. Query: `hard=true` para delete físico. |

### Artigos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/artigos` | Lista todos os artigos. |
| POST | `/admin/api/artigos` | Cria artigo (campos permitidos no body). |
| GET | `/admin/api/artigos/:id` | Um artigo por id. |
| PUT | `/admin/api/artigos/:id` | Atualiza artigo. |
| DELETE | `/admin/api/artigos/:id` | Remove artigo. |
| POST | `/admin/api/artigos/upload` | Upload de imagem (base64 no body). Retorna URL relativa do arquivo. |

### Links úteis

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/admin/api/links` | Lista links. |
| POST | `/admin/api/links` | Cria link (name, url obrigatórios; description, label, icon_url, sort_order). URL validada. |
| GET | `/admin/api/links/:id` | Um link por id (UUID). |
| PUT | `/admin/api/links/:id` | Atualiza link. |
| DELETE | `/admin/api/links/:id` | Remove link. |
| POST | `/admin/api/links/upload` | Upload de ícone (base64). Retorna URL relativa. |

---

## CORS

O servidor envia `Access-Control-Allow-Origin` apenas para origens permitidas: valor de `ALLOWED_ORIGINS` (lista separada por vírgula) ou, se não definido, localhost e `*.supabase.co`. Em produção recomenda-se definir `ALLOWED_ORIGINS` com o(s) domínio(s) do front.

---

## Headers de segurança

Todas as respostas da API incluem headers como: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`. Rotas admin incluem também `Cache-Control: no-store, no-cache, must-revalidate`.

Este documento não inclui exemplos com tokens, chaves ou dados reais.
