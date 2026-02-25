# Arquitetura

Este documento descreve a arquitetura de alto nível do Linux Simulados, os fluxos principais e as decisões técnicas, sem expor dados sensíveis.

---

## Visão geral

- **Monólito servidor:** Um processo Node.js (`server.js`) atende requisições HTTP: API REST e entrega de arquivos estáticos (HTML, CSS, JS, imagens).
- **Frontend:** Páginas HTML que carregam módulos JavaScript (ES modules). Não há build step; o navegador carrega os scripts diretamente.
- **Backend como API:** Toda lógica de negócio e acesso a dados passa pelo servidor. O front chama rotas como `/api/artigos`, `/api/simulados`, `/admin/api/*`, etc.
- **Supabase:** Autenticação (Auth) e banco (PostgreSQL via PostgREST). O servidor usa chave anon e, quando configurado, chave de serviço para operações administrativas.

---

## Fluxo de requisição

1. O usuário acessa uma URL (ex.: `/`, `/simulados.html`, `/admin/usuarios.html`).
2. O servidor verifica o pathname:
   - Se for `/api/*` ou `/admin/api/*`, delega para `handleAPI()`.
   - Caso contrário, trata como arquivo estático em `public/` (com validação de path para evitar path traversal).
3. Em `handleAPI()`:
   - Aplica headers de segurança e CORS (com base em `ALLOWED_ORIGINS` ou fallback para localhost / Supabase).
   - Aplica rate limit (em memória ou Redis, se `REDIS_URL` estiver definido).
   - Para rotas `/admin/api/*`, exige Bearer token e checagem de admin (Auth + tabela `users.role` ou `ADMIN_EMAIL`).
   - Encaminha para o handler da rota correspondente (leitura/escrita no Supabase ou upload de arquivo).

---

## Autenticação

- **Supabase Auth** com provedor Google (OAuth). O cliente no front é criado com URL e chave anon obtidas via `GET /api/config` (que lê do `.env` do servidor).
- **Sessão:** Mantida pelo Supabase no navegador (localStorage). O servidor não mantém sessão própria; para rotas protegidas (admin), o front envia o token no header `Authorization: Bearer <access_token>`.
- **Identidade do admin:** O servidor considera admin quem:
  - tem e-mail igual a `ADMIN_EMAIL` (se a variável estiver definida), ou
  - possui `role = 'admin'` na tabela `public.users` (consultada com client de serviço quando disponível).
- **Páginas que exigem login:** Simulados, progresso e página do simulado LPIC-1 redirecionam para `/login.html` com `?redirect=` permitido apenas para páginas da allowlist (evita open redirect).
- **Páginas públicas adicionais:** Saiba mais (`/saiba-mais.html`) com texto institucional, FAQ em accordion e contato; item de menu “Comunidade” existe mas está inativo (badge “Em breve”, tooltip ao passar o mouse).

---

## Painel administrativo

- **Acesso:** Apenas usuários autenticados que passam na checagem de admin (acima). O botão "Painel Admin" na página inicial só aparece se `GET /admin/api/me` retornar sucesso.
- **Rotas:** Todas sob `/admin/api/*` (usuários, stats, simulados, exames, questões, artigos, links e uploads). Respostas com `Cache-Control: no-store` para não cachear dados sensíveis.
- **Frontend admin:** Páginas em `public/admin/*.html` que consomem essas APIs e usam o mesmo token de sessão.

---

## Dados e Supabase

- **Auth:** Contas e tokens gerenciados pelo Supabase Auth.
- **Tabelas de aplicação:** `users`, `sessions`, `simulados`, `exams`, `questions`, `articles`, `useful_links`, `access_log`. Detalhes em [DATA_MODEL.md](DATA_MODEL.md).
- **RLS:** Recomenda-se configurar Row Level Security no Supabase conforme as políticas de acesso desejadas. O servidor, quando usa a chave de serviço, contorna RLS para operações administrativas.

---

## Rate limiting

- **Objetivo:** Limitar requisições por IP para reduzir abuso e sobrecarga.
- **Regras:** Janela de 1 minuto; limites distintos para rotas admin (ex.: 40 req/min) e demais APIs (ex.: 120 req/min).
- **Implementação:** Por padrão, um mapa em memória por instância. Se `REDIS_URL` estiver definido, o contador é compartilhado via Redis (recomendado quando houver múltiplas instâncias).

---

## Upload de arquivos

- **Uso:** Imagens de artigos e ícones de links, enviadas em base64 no body JSON para rotas específicas (`/admin/api/artigos/upload`, `/admin/api/links/upload`).
- **Armazenamento:** Nome do arquivo sempre gerado no servidor (UUID + extensão), nunca o nome enviado pelo cliente. Extensões permitidas: jpg, jpeg, png, webp. Tamanho máximo por imagem definido no servidor (ex.: 200 KB).
  - **Artigos (capas):** Se `SUPABASE_STORAGE_BUCKET_ARTIGOS` (ou `SUPABASE_STORAGE_BUCKET`) e chave de serviço estiverem definidos, o arquivo é enviado ao Supabase Storage e a URL pública é retornada (persiste após deploy). Caso contrário, salvo em disco em `public/uploads/artigos/`.
  - **Links (ícones):** Salvos em disco em `public/uploads/links/`.
- **Segurança:** Apenas admins; validação de extensão e verificação de que o path resolvido permanece dentro do diretório de uploads (path traversal).

---

## Diagrama simplificado

```
[Browser] --> [Node server (server.js)]
                  |
                  +-- serve static (public/)
                  +-- handleAPI()
                        |
                        +-- /api/config, /api/artigos, /api/links, /api/simulados, ... (público ou com auth)
                        +-- /admin/api/* (sempre requireAdmin)
                  |
                  v
            [Supabase]
                  +-- Auth (tokens, OAuth)
                  +-- PostgREST (tabelas)
            [Redis] (opcional, rate limit)
```

Este documento não contém URLs reais, chaves ou dados de usuários.
