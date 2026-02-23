# ============================================================
# LinuxGeek — Guia de Prompts para o Cursor
# Feature: Meu Progresso (progresso.html)
# ============================================================
# Execute UM passo por vez. Só avance para o próximo
# depois de validar visualmente o resultado no navegador.
# ============================================================

---

## ANTES DE COMEÇAR

Abra o projeto no Cursor com File → Open Folder.
Confirme que estes arquivos estão na pasta:
  ✓ index.html
  ✓ simulado-lpic1.html
  ✓ .cursorrules
  ✓ PROGRESSO_FEATURE_SPEC.md

---

## PASSO 1 — Preparar o simulado para gravar dados

Cole este prompt no Cursor:

> Leia o arquivo PROGRESSO_FEATURE_SPEC.md completamente.
> Agora faça APENAS esta tarefa no arquivo simulado-lpic1.html:
> adicione a função saveSessionToStorage() e chame ela dentro
> de finishSimulado() conforme descrito na seção
> "CONTRATO DE DADOS — localStorage" da spec.
> Não altere mais nada no arquivo.

✅ Como validar:
Abra simulado-lpic1.html no navegador, faça um simulado
curto até o fim, abra o DevTools (F12) → Application →
Local Storage → deve aparecer a chave "linuxgeek_progress"
com um array JSON contendo a sessão que você acabou de fazer.

---

## PASSO 2 — Criar a estrutura base da página

Cole este prompt no Cursor:

> Leia o arquivo PROGRESSO_FEATURE_SPEC.md.
> Crie o arquivo progresso.html com APENAS a estrutura base:
> - mesmo topbar do simulado-lpic1.html (logo + breadcrumb + link Dashboard)
> - mesma sidebar do index.html (com item Meu Progresso como active)
> - área de conteúdo vazia com o título da página
> - importar as mesmas fontes do Google Fonts que os outros arquivos usam
> - todas as variáveis CSS do design system (copiar do index.html)
> Não crie nenhum bloco de conteúdo ainda. Só a casca da página.

✅ Como validar:
Abra progresso.html no navegador. Deve ter o topbar verde,
a sidebar com os mesmos itens do dashboard, e "Meu Progresso"
destacado como ativo. Layout visual idêntico ao index.html.

---

## PASSO 3 — JavaScript base e leitura do localStorage

Cole este prompt no Cursor:

> No arquivo progresso.html, adicione APENAS o bloco JavaScript
> base descrito na spec: a função loadSessions() que lê o
> localStorage com try/catch, e a função principal
> renderProgressPage() que chama loadSessions() e, se não
> houver dados, exibe o empty state descrito na spec.
> Inclua também o CSS do empty state.
> Não renderize nenhum bloco de métricas ainda.

✅ Como validar:
Abra progresso.html no navegador com localStorage vazio
(ou limpe com DevTools → Application → Clear storage).
Deve aparecer o pinguim 🐧 com a mensagem de empty state
e o botão "Fazer meu primeiro simulado".

---

## PASSO 4 — Cards de métricas globais

Cole este prompt no Cursor:

> No arquivo progresso.html, adicione APENAS o Bloco 1:
> os 4 cards de métricas globais (Total de Simulados,
> Melhor Nota, Média Geral, Aprovações) conforme descrito
> na seção "Bloco 1 — Métricas Globais" da spec.
> Use os cálculos exatos descritos na spec.
> Inclua o CSS do componente metric-card.
> Os cards só aparecem se houver sessões no localStorage.
> Se não houver sessões, continua mostrando o empty state.

✅ Como validar:
Faça 2 ou 3 simulados curtos para gerar dados no localStorage,
depois abra progresso.html. Os 4 cards devem aparecer com
valores reais. Confirme que com localStorage vazio ainda
aparece o empty state, não cards zerados.

---

## PASSO 5 — Streak e heatmap

Cole este prompt no Cursor:

> No arquivo progresso.html, adicione APENAS o Bloco 2:
> o display de streak com o número de dias consecutivos
> e o heatmap dos últimos 30 dias, conforme descrito na
> seção "Bloco 2 — Streak" da spec.
> Use exatamente o algoritmo calcStreak() e generateHeatmap()
> da spec. Inclua o CSS de streak-block, heatmap-wrap,
> heatmap-grid e heatmap-day com todos os estados visuais
> (has-session, passed, today-empty, today-done).

✅ Como validar:
Os quadradinhos do heatmap devem aparecer, com os dias
que você fez simulado em verde. O número de streak deve
bater com quantos dias seguidos você fez pelo menos 1 simulado.
Passe o mouse sobre um quadradinho — deve mostrar tooltip
com a data.

---

## PASSO 6 — Gráfico de evolução de notas

Cole este prompt no Cursor:

> No arquivo progresso.html, adicione APENAS o Bloco 3:
> o gráfico SVG de evolução de notas dos últimos 20 simulados,
> conforme descrito na seção "Bloco 3 — Gráfico de Evolução"
> da spec. Use exatamente a função renderScoreChart() da spec.
> A linha vermelha tracejada em 70% é obrigatória.
> Pontos verdes para aprovado, vermelhos para reprovado.
> Se houver menos de 2 sessões, mostrar mensagem de empty
> state específica para este bloco.

✅ Como validar:
O gráfico deve aparecer com a linha de evolução e os pontos
coloridos. A linha tracejada em 70% deve estar visível.
Teste com menos de 2 sessões — deve aparecer a mensagem
"Faça pelo menos 2 simulados para ver o gráfico".

---

## PASSO 7 — Tabela de histórico com dropdown e lixeira por linha

Cole este prompt no Cursor:

> No arquivo progresso.html, adicione APENAS o Bloco 4:
> a tabela de histórico conforme a seção "Bloco 4 — Histórico
> de Simulados" da spec. Regras obrigatórias:
> - Header da tabela com título à esquerda e select dropdown
>   à direita para filtrar por simulado (gerado dinamicamente)
> - 7 colunas: Data, Simulado, Questões, Nota, Tempo, Status, Ação
> - Coluna Ação: botão lixeira 🗑 discreto em cada linha
> - Mostrar últimas 10 sessões por padrão
> - Botão "Ver todas" expande para histórico completo
> - Clicar na lixeira chama promptDeleteSession(session)
>   mas ainda SEM implementar o modal — só o botão visual
> Inclua o CSS de history-select, delete-btn e a lógica
> de filtro com getFilteredSessions() e getSimuladosInHistory().

✅ Como validar:
O header da tabela deve ter o select de filtro à direita.
Cada linha deve ter um ícone 🗑 discreto na última coluna.
Mudar o select filtra as linhas corretamente.
Clicar na lixeira ainda não faz nada (modal vem no próximo passo).

---

## PASSO 8 — Recomendações inteligentes

Cole este prompt no Cursor:

> No arquivo progresso.html, adicione APENAS o Bloco 5:
> os 3 cards de recomendações inteligentes, conforme descrito
> na seção "Bloco 5 — Recomendações Inteligentes" da spec.
> Use exatamente a função generateRecommendations() da spec.
> As recomendações devem ser dinâmicas e baseadas nos dados
> reais do localStorage. Inclua o CSS de recs-grid e rec-card.

✅ Como validar:
Devem aparecer até 3 cards com ícone, título, descrição
e link de ação. O conteúdo deve mudar dependendo dos seus
dados: se tiver streak, aparece mensagem de parabéns; se
a média estiver abaixo de 70%, aparece sugestão de melhora; etc.

---

## PASSO 9 — Modal de confirmação para apagar sessão individual

Cole este prompt no Cursor:

> No arquivo progresso.html, implemente a lógica completa
> da lixeira conforme a seção "COMPORTAMENTO DA LIXEIRA E
> MODAL DE CONFIRMAÇÃO" da spec. Regras obrigatórias:
> - Usar exatamente as funções promptDeleteSession() e
>   deleteSession() definidas na spec
> - O modal deve mostrar os dados da sessão específica:
>   data, simulado e nota (não texto genérico)
> - Ao confirmar, remover APENAS a sessão pelo campo id
>   usando all.filter(s => s.id !== sessionId)
> - Ao cancelar, fechar o modal sem alterar nada
> - Após deletar, rerenderizar a página inteira
> - Se não restar nenhuma sessão, mostrar empty state
> Incluir o CSS de modal-overlay, modal-box e modal-actions.

✅ Como validar:
Clicar em 🗑 abre o modal com os dados exatos daquela linha
(data, simulado e nota preenchidos dinamicamente).
Cancelar fecha sem apagar. Confirmar remove só aquela linha.
A tabela atualiza imediatamente sem recarregar a página.
Se apagar a última sessão, aparece o empty state.

---

## PASSO 10 — Atualizar navegação nos outros arquivos

Cole este prompt no Cursor:

> Faça APENAS estas duas alterações cirúrgicas:
> 1. No index.html: localize o nav-item "Meu Progresso"
>    na sidebar e atualize o href para "progresso.html"
> 2. No simulado-lpic1.html: localize o nav-item
>    "Meu Progresso" na sidebar e atualize o href
>    para "progresso.html"
> Não altere mais nada nesses arquivos.

✅ Como validar:
Abra index.html, clique em "Meu Progresso" na sidebar —
deve navegar para progresso.html. Volte, abra um simulado,
clique em "Meu Progresso" — mesma coisa.

---

## PASSO 11 — Revisão final e responsivo

Cole este prompt no Cursor:

> Revise o arquivo progresso.html completo e corrija
> apenas problemas de layout responsivo para mobile
> conforme as regras de @media descritas na spec.
> Em telas < 900px: metrics-grid vira 2 colunas,
> recs-grid vira 1 coluna.
> Em telas < 600px: ocultar coluna "Tempo" da tabela.
> Não altere nenhuma lógica JavaScript nem o design
> em desktop. Apenas ajustes de CSS responsivo.

✅ Como validar:
Abra progresso.html e redimensione a janela para menos
de 600px de largura (ou use DevTools → Toggle device toolbar).
Os cards devem reorganizar em 2 colunas. A tabela deve
ficar legível sem scroll horizontal.

---

## CHECKLIST FINAL

Antes de considerar a feature entregue, teste tudo:

  [ ] Fazer 3 simulados completos no simulado-lpic1.html
  [ ] Abrir progresso.html e ver todos os 5 blocos com dados reais
  [ ] Abrir com localStorage vazio e ver o empty state
  [ ] Testar o heatmap (quadradinhos dos dias)
  [ ] Testar o gráfico de evolução (linha + pontos)
  [ ] Select de filtro popula dinamicamente com os simulados no histórico
  [ ] Filtrar por simulado funciona corretamente
  [ ] Cada linha tem lixeira 🗑 visível ao hover
  [ ] Clicar na lixeira abre modal com data, simulado e nota corretos
  [ ] Cancelar fecha o modal sem apagar nada
  [ ] Confirmar apaga APENAS aquela sessão, tabela atualiza
  [ ] Apagar última sessão → empty state aparece
  [ ] Clicar em "Meu Progresso" no index.html → navega corretamente
  [ ] Testar no mobile (< 600px de largura)
  [ ] Confirmar que index.html e simulado-lpic1.html não foram quebrados

---

## SE ALGO DER ERRADO

Se o Cursor alterar o design ou quebrar algo:

  → "Desfaça a última alteração. Você modificou [descreva o que mudou]
     sem autorização. Releia o .cursorrules antes de continuar."

Se o resultado não bater com a spec:

  → "O resultado não está correto. Releia a seção [nome da seção]
     do PROGRESSO_FEATURE_SPEC.md e refaça apenas esse bloco."

Se o Cursor tentar fazer vários passos de uma vez:

  → "Pare. Faça apenas o que foi pedido neste passo.
     Não antecipe os próximos passos."
