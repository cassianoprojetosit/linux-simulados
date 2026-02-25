# Deploy em produção

Este documento descreve como colocar o projeto em produção em uma plataforma de hospedagem (ex.: Render), sem incluir credenciais ou dados sensíveis.

---

## Pré-requisitos

- Repositório Git com o código atualizado.
- Projeto Supabase criado, com Auth (Google) e tabelas configuradas (ver [DATA_MODEL.md](DATA_MODEL.md)).
- Conta em um provedor de hospedagem (ex.: Render, Railway, Fly.io) que suporte Node.js e variáveis de ambiente.

---

## Exemplo: Render (Web Service)

1. **Criar Web Service**
   - No dashboard Render, crie um novo Web Service.
   - Conecte o repositório Git (branch normalmente `main`).
   - Build command: `npm install` (ou deixe o padrão).
   - Start command: `npm start`.

2. **Variáveis de ambiente**
   - Na aba **Environment** do serviço, defina todas as variáveis necessárias. Use os **nomes** abaixo; os **valores** vêm do seu projeto Supabase e da sua infraestrutura (nunca commitar no repositório).

   | Variável | Obrigatória | Onde obter |
   |----------|-------------|------------|
   | `PORT` | Não | Render define automaticamente; só defina se precisar override. |
   | `SUPABASE_URL` | Sim | Dashboard Supabase → Settings → API → Project URL. |
   | `SUPABASE_PUBLISHABLE_KEY` | Sim | Dashboard Supabase → Settings → API → anon public key. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Recomendado para admin | Dashboard Supabase → Settings → API → service_role key. **Secreta.** |
   | `ADMIN_EMAIL` | Opcional | E-mail que terá acesso admin sem depender da tabela `users`. |
   | `ALLOWED_ORIGINS` | Recomendado em produção | Origens CORS: domínio(s) do site, separados por vírgula (ex.: `https://seusite.com,https://www.seusite.com`). Inclua também a URL do app na Render se usuários acessarem por ela (ex.: `https://seu-app.onrender.com`). |
   | `REDIS_URL` | Opcional | Só se quiser rate limit distribuído (múltiplas instâncias). URL completa do Redis (ex.: `rediss://...` para TLS). |
   | `SUPABASE_STORAGE_BUCKET_ARTIGOS` | Opcional | Nome do bucket no Supabase Storage para imagens de capa. Se definido (com `SUPABASE_SERVICE_ROLE_KEY`), as capas passam a ser salvas no Storage e a URL persiste após cada deploy. Caso contrário, as imagens ficam em `public/uploads/artigos` e só persistem se você versionar e enviar esses arquivos no Git. |

3. **Deploy**
   - Após salvar as variáveis, o Render pode fazer redeploy automático. Ou use **Manual Deploy** → **Deploy latest commit**.
   - Verifique os logs para garantir que o servidor subiu e que não há erro de variável faltando.

4. **Domínio customizado (opcional)**
   - Em **Settings** do serviço, adicione o domínio customizado (ex.: `seusite.com`). Configure o DNS conforme instruções da Render.
   - Atualize `ALLOWED_ORIGINS` para incluir `https://seusite.com` (e `https://www.seusite.com` se usar www).

---

## Checklist pós-deploy

- [ ] Site abre no navegador (página inicial, login, simulados).
- [ ] Login com Google funciona (redirect OAuth e retorno ao site).
- [ ] `/api/config` retorna JSON com `supabaseUrl` e `supabaseAnonKey` (sem expor a chave de serviço).
- [ ] Painel admin acessível apenas após login com usuário admin; botão "Painel Admin" aparece apenas para admins.
- [ ] CORS: se o front for servido por outro domínio, `ALLOWED_ORIGINS` deve incluir esse domínio; caso contrário chamadas fetch podem falhar por CORS.
- [ ] Nenhuma chave secreta (service_role, Redis, etc.) em logs ou no frontend.
- [ ] **Imagens de capa dos artigos:** Se não usar Supabase Storage (`SUPABASE_STORAGE_BUCKET_ARTIGOS`), lembre-se de que arquivos em `public/uploads/artigos` só existem no servidor se tiverem sido commitados e enviados no repositório; após um deploy “limpo”, capas antigas podem sumir. Para evitar isso, use um bucket público no Supabase e defina a variável acima.

---

## Outras plataformas

- **Railway / Fly.io / Heroku:** Fluxo equivalente: conectar repositório, definir comando de start (`npm start`), configurar todas as variáveis de ambiente listadas acima. Garantir que `PORT` seja usado pelo runtime (muitas plataformas injetam `PORT` automaticamente).
- **VPS (Node na máquina):** Instalar Node, clonar o repositório, `npm install`, criar `.env` com as variáveis, iniciar com `npm start` ou um gerenciador de processos (ex.: PM2). Usar reverse proxy (ex.: Nginx) e TLS na frente do Node.

Este documento não contém URLs reais, chaves ou senhas.
