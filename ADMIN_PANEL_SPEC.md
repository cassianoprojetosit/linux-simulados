# ============================================================
# LinuxGeek — Especificação do Painel Administrativo
# Admin Panel Spec v1.0 | Fev 2026
# ============================================================
# Leia completamente antes de escrever uma linha de código.
# ============================================================

---

## 🎯 OBJETIVO

Criar um painel administrativo em `/admin` que permita ao administrador
gerenciar todo o conteúdo do site sem precisar editar código:
simulados, questões, usuários, artigos, menus e links úteis.

---

## 🔐 ACESSO E SEGURANÇA

### Dupla camada de autenticação
1. **Login com Google** — o admin faz login com o Google normalmente
2. **Verificação de role** — o backend verifica se o usuário tem `role = 'admin'` no banco

### Como definir o admin no banco
```sql
-- Executar no Supabase SQL Editor para definir o admin
update users set role = 'admin' where email = 'seu@email.com';
```

### Tabela users — adicionar coluna role
```sql
alter table users add column if not exists role varchar default 'user' 
  check (role in ('user', 'admin'));
```

### Middleware de proteção
```javascript
// server/middleware/admin.middleware.js
export async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1]
  if (!token) return res.status(401).json({ error: 'Não autorizado' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Token inválido' })

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado' })
  }

  req.user = user
  next()
}
```

### Regras de segurança obrigatórias
- Todas as rotas `/admin/api/*` protegidas pelo middleware `requireAdmin`
- Verificação feita SEMPRE no backend — nunca confiar só no frontend
- Logs de todas as ações do admin (quem fez o quê e quando)
- Rate limiting nas rotas admin: máximo 60 req/min

---

## 📐 ESTRUTURA DE ARQUIVOS

```
public/
└── admin/
    ├── index.html          ← dashboard admin (métricas)
    ├── simulados.html      ← gerenciar simulados
    ├── questoes.html       ← gerenciar questões
    ├── usuarios.html       ← gerenciar usuários
    ├── artigos.html        ← gerenciar artigos
    ├── menus.html          ← gerenciar navegação
    └── links.html          ← gerenciar links úteis

public/js/
└── admin.js               ← funções compartilhadas do admin
```

---

## 🎨 DESIGN DO PAINEL

### Layout
- Mesmo dark theme do site (variáveis CSS idênticas)
- Sidebar própria do admin com links para cada módulo
- Topbar com nome/foto do admin logado + botão "Ver site"
- Sem sidebar do site público — admin tem navegação própria

### Sidebar do admin
```
⚙️ PAINEL ADMIN
─────────────────
📊 Dashboard
🎓 Simulados
❓ Questões
👥 Usuários
📝 Artigos
🔗 Links Úteis
🗂️ Menus
─────────────────
👁️ Ver site
🚪 Sair
```

---

## 📊 MÓDULO 1 — DASHBOARD ADMIN

### Métricas exibidas
- Total de usuários (free / pro)
- Usuários novos hoje / esta semana
- Total de sessões hoje
- Simulado mais usado
- Últimos 5 usuários cadastrados

---

## 🎓 MÓDULO 2 — SIMULADOS

### Listagem
Tabela com todos os simulados:
| Nome | Slug | Plano | Questões | Status | Ações |
|------|------|-------|----------|--------|-------|
| LPIC-1 | lpic1 | Free | 298 | ✅ Ativo | Editar / Desativar |

### Criar/Editar simulado
Formulário com os campos:
- Título (ex: "LPIC-2")
- Slug (gerado automaticamente, editável)
- Descrição
- Nota mínima de aprovação (padrão: 70)
- Plano necessário (Free / Pro)
- Status (Ativo / Rascunho)

### Gerenciar exames de um simulado
Ao clicar em um simulado, listar seus exames:
- Exame 101 — System Architecture (158 questões)
- Exame 102 — Linux Setup & Scripting (140 questões)
- Botão "+ Adicionar exame"

---

## ❓ MÓDULO 3 — QUESTÕES

### Listagem com filtros
Filtros disponíveis:
- Simulado (dropdown)
- Exame (dropdown, depende do simulado)
- Tópico (dropdown)
- Tipo (Múltipla escolha / Digitação)
- Dificuldade (Fácil / Médio / Difícil)
- Status (Ativa / Inativa)

Tabela:
| # | Questão (resumo) | Tipo | Tópico | Dificuldade | Status | Ações |
|---|-----------------|------|--------|-------------|--------|-------|

### Criar questão individual (formulário)
```
Simulado: [dropdown]
Exame:    [dropdown]
Tópico:   [input texto] ex: 101.1
Tipo:     [radio] Múltipla escolha | Digitação
Dificuldade: [radio] Fácil | Médio | Difícil

Pergunta: [textarea]

[Se múltipla escolha:]
Opção A: [input]
Opção B: [input]
Opção C: [input]
Opção D: [input]
Opção E: [input] (opcional)
Resposta correta: [radio A/B/C/D/E]

[Se digitação:]
Resposta: [input]

Dica: [input] (opcional)
Explicação: [textarea] (opcional, visível apenas para Pro)

[Botão: Salvar questão]
```

### Import em lote via JSON
Área para colar ou fazer upload de arquivo `.json`:
```json
[
  {
    "exam": "101",
    "topic": "101.1",
    "type": "multiple",
    "question": "Qual comando lista módulos do kernel?",
    "options": ["modinfo", "lsmod", "insmod", "rmmod"],
    "correct": 1,
    "difficulty": "easy",
    "hint": "Lista módulos carregados"
  }
]
```

Botão "Validar JSON" antes de importar.
Exibe preview com quantidade de questões detectadas.
Botão "Importar X questões" confirma a importação.

### Editar questão
Mesmo formulário de criação preenchido com os dados existentes.

### Ações por questão
- ✏️ Editar
- 🔴 Desativar (soft delete — não apaga do banco)
- 🟢 Ativar
- 🗑️ Excluir (pede confirmação, hard delete)

---

## 👥 MÓDULO 4 — USUÁRIOS

### Listagem com filtros
Filtros:
- Plano (Free / Pro)
- Data de cadastro (período)
- Busca por email ou nome

Tabela:
| Nome | Email | Plano | Cadastro | Último acesso | Simulados | Ações |
|------|-------|-------|----------|---------------|-----------|-------|

### Ações por usuário
- Ver detalhes (histórico de sessões)
- Alterar plano (Free ↔ Pro)
- Bloquear/desbloquear
- **Nunca** excluir — apenas bloquear

### Detalhes do usuário
- Informações básicas (nome, email, foto, plano)
- Histórico de sessões (simulado, nota, data)
- Gráfico de atividade

---

## 📝 MÓDULO 5 — ARTIGOS

### Listagem
Tabela com todos os artigos:
| Emoji | Título | Categoria | Ordem | Status | Ações |
|-------|--------|-----------|-------|--------|-------|

### Criar/Editar artigo
```
Emoji:      [input] ex: 🚀
Título:     [input]
Excerpt:    [textarea] resumo curto
URL:        [input] link externo ou caminho interno
Categoria:  [input] ex: "Guia", "Referência", "Prática"
Ordem:      [number] posição na listagem
Status:     [toggle] Ativo / Inativo

[Botão: Salvar]
```

### Ordenação
Drag-and-drop ou campo numérico para reordenar artigos.

---

## 🗂️ MÓDULO 6 — MENUS

### O que pode ser gerenciado
Itens da sidebar do site público:

**Seção Principal:**
- Dashboard
- Simulados
- Artigos
- Meu Progresso

**Seção Recursos:**
- Links Úteis
- Comunidade

### Ações disponíveis
- Renomear item de menu
- Alterar ícone (emoji)
- Alterar URL de destino
- Ativar / Desativar item
- Reordenar (drag-and-drop)
- Adicionar novo item
- Criar nova seção

### Tabela no banco
```sql
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  section varchar not null,      -- ex: 'principal', 'recursos'
  label varchar not null,        -- ex: 'Dashboard'
  icon varchar,                  -- emoji ex: '⊞'
  href varchar not null,         -- ex: '/index.html'
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp default now()
);
```

---

## 🔗 MÓDULO 7 — LINKS ÚTEIS

### Listagem
Tabela com todos os links:
| Emoji | Nome | URL | Label | Ordem | Status | Ações |
|-------|------|-----|-------|-------|--------|-------|

### Criar/Editar link
```
Emoji:       [input] ex: 🏛️
Nome:        [input] ex: "LPI.org"
Descrição:   [input] ex: "Site oficial da certificação LPIC"
URL:         [input]
Label:       [select] Oficial / Parceiro / Ferramenta / Referência / Prática
Ordem:       [number]
Status:      [toggle] Ativo / Inativo

[Botão: Salvar]
```

---

## 🔄 ROTAS DA API ADMIN

```
GET    /admin/api/stats              → métricas do dashboard
GET    /admin/api/simulados          → listar simulados
POST   /admin/api/simulados          → criar simulado
PUT    /admin/api/simulados/:id      → editar simulado
DELETE /admin/api/simulados/:id      → desativar simulado

GET    /admin/api/questoes           → listar questões (com filtros)
POST   /admin/api/questoes           → criar questão
POST   /admin/api/questoes/import    → importar JSON em lote
PUT    /admin/api/questoes/:id       → editar questão
DELETE /admin/api/questoes/:id       → desativar/excluir questão

GET    /admin/api/usuarios           → listar usuários
PUT    /admin/api/usuarios/:id/plan  → alterar plano
PUT    /admin/api/usuarios/:id/block → bloquear/desbloquear

GET    /admin/api/artigos            → listar artigos
POST   /admin/api/artigos            → criar artigo
PUT    /admin/api/artigos/:id        → editar artigo
DELETE /admin/api/artigos/:id        → remover artigo

GET    /admin/api/menus              → listar itens de menu
POST   /admin/api/menus              → criar item
PUT    /admin/api/menus/:id          → editar item
DELETE /admin/api/menus/:id          → remover item
PUT    /admin/api/menus/reorder      → reordenar itens

GET    /admin/api/links              → listar links
POST   /admin/api/links              → criar link
PUT    /admin/api/links/:id          → editar link
DELETE /admin/api/links/:id          → remover link
```

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

1. Setup da proteção admin (middleware + coluna role no banco)
2. Layout base do painel (sidebar + topbar admin)
3. Dashboard com métricas
4. Módulo Questões (mais usado no dia a dia)
5. Módulo Simulados
6. Módulo Artigos
7. Módulo Links Úteis
8. Módulo Menus
9. Módulo Usuários

---

## ✅ CHECKLIST DE ENTREGA

- [ ] Coluna `role` adicionada na tabela `users`
- [ ] Tabela `menu_items` criada no banco
- [ ] Middleware `requireAdmin` protegendo todas as rotas `/admin/api/*`
- [ ] Acesso negado com 403 para não-admins
- [ ] Layout base do painel com sidebar e topbar
- [ ] Dashboard com métricas básicas funcionando
- [ ] CRUD completo de questões (individual + import JSON)
- [ ] CRUD completo de simulados e exames
- [ ] CRUD completo de artigos
- [ ] CRUD completo de links úteis
- [ ] Gerenciamento de menus funcionando
- [ ] Listagem e edição de usuários
- [ ] Logs de ações do admin no console do servidor
- [ ] Rate limiting nas rotas admin
- [ ] Testado com usuário sem role admin (deve retornar 403)
