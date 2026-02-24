# Como contribuir

Obrigado pelo interesse em contribuir com o projeto. Este documento descreve práticas recomendadas para manter qualidade e segurança.

---

## Código e repositório

- **Não commitar:** Arquivo `.env`, chaves, senhas, tokens ou qualquer dado sensível. Use `.env.example` como modelo, sem valores reais.
- **Padrões:** Manter consistência com o código existente (ES modules, estilo do servidor em `server.js`, módulos em `public/js/`).
- **Segurança:** Novas rotas devem validar entrada (tamanho, tipo, whitelist de colunas quando aplicável). Rotas admin devem passar por `requireAdmin`. Não expor informações internas em mensagens de erro ao cliente.
- **Documentação:** Atualizar `README.md` e, se necessário, os arquivos em `docs/` quando houver mudança de arquitetura, API ou deploy.

---

## Antes de enviar mudanças

- Testar localmente com `npm start` e verificar fluxos principais (login, simulados, progresso, painel admin).
- Garantir que nenhuma credencial ou dado sensível foi adicionada ao repositório.
- Se alterar variáveis de ambiente, atualizar `.env.example` e `docs/DEPLOYMENT.md` (e `README.md` se for o caso).

---

## Documentação adicional

- [README.md](README.md) — Visão geral e início rápido.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Arquitetura e fluxos.
- [docs/API.md](docs/API.md) — Rotas da API.
- [docs/SECURITY.md](docs/SECURITY.md) — Práticas de segurança.

Não inclua dados pessoais, e-mails ou informações sensíveis em issues, PRs ou documentação.
