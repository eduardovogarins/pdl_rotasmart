# Auditor Inteligente v3 — Saúde da conta

> Substitui integralmente o v2. Cole a partir da linha `---` no chat do Lovable.
> O que mudou e por quê está no final, na seção "O que saiu do v2".

---

# Refatoração: de checklist técnico para painel de saúde da conta

Este app **não é uma segunda central de monitoramento**. A Rota Smart tem monitoramento 24/7: quando um cliente fica offline, a central já detecta, abre manutenção e gera ticket para o PCP, em horas. Nada disso precisa ser redescoberto por um auditor semanas depois.

A auditoria existe para responder três perguntas que o monitoramento não responde, porque ele trata evento e a auditoria trata padrão:

1. **O cliente está usando o serviço?**
2. **Nós estamos entregando a manutenção como prometido?**
3. **O que foi instalado ainda entrega o que foi vendido?**

O objetivo final é **reduzir churn silencioso**. Cliente que parou de armar o alarme não abre chamado, não reclama e não aparece em nenhum indicador — só aparece no dia em que pede o cancelamento, com o argumento de que não usa. A auditoria é o que enxerga isso antes.

**Regra que organiza o sistema inteiro:** o monitoramento cuida do agudo, a auditoria cuida do crônico. Se um problema é detectado e resolvido pela central em horas, ele não é achado de auditoria. Só vira achado quando **persiste**, **reincide** ou **o monitoramento não consegue ver**.

---

## PARTE 1 — Três notas, não uma

O app deixa de calcular um score único. Cada auditoria produz **três notas de 0 a 100**, uma por pergunta:

| Pilar | Pergunta | Fonte | Quem age quando cai |
|---|---|---|---|
| **USO** | O cliente usa o serviço? | Log de eventos (automático) | Comercial / relacionamento |
| **ENTREGA** | Cumprimos a manutenção? | Planilha de OS (automático) | PCP / planejamento |
| **CONDIÇÃO** | O equipamento entrega o contratado? | Checklist manual + padrões do log | Técnica / manutenção |

Um número único misturaria os três e esconderia justamente a informação que decide a ação. Cliente com Uso 40 e Condição 100 não tem problema técnico — tem problema comercial, e a média de 70 não diria isso.

No Histórico e no Dashboard, mostrar sempre as três notas lado a lado, nunca só a faixa.

---

## PARTE 2 — Pilar USO

### 2.1 Cálculo

```
USO = (noites protegidas ÷ noites esperadas) × 100
```

`noites protegidas` vem da máquina de estados armado/desarmado do log de eventos (Parte 6). Para cada janela de 22h às 06h do período, o sistema esteve armado em algum momento?

`noites esperadas` vem do cadastro do cliente, campo `perfil_de_uso`:

| Perfil | Noites esperadas | Exemplo |
|---|---|---|
| `COMERCIAL` (padrão) | Todas as noites do período | Escritório, depósito, loja |
| `COMERCIAL_SEG_SEX` | Só noites de dias úteis | Cliente que já fica armado o fim de semana inteiro |
| `24_HORAS` | — Pilar não se aplica, exibir `N/A` | Unidade com operação contínua e vigilância presencial |

Sem esse cadastro, uma unidade 24 horas seria reprovada por não armar, o que é o comportamento correto dela. Popule `COMERCIAL` como padrão e ajuste na primeira auditoria.

### 2.2 A trava que mais erra na conta manual

`noites protegidas` **não é** "dias com evento de ativação". Quando o cliente arma na sexta e só desarma na segunda, sábado e domingo não têm nenhum evento de ativação e mesmo assim estiveram protegidos. Contar evento produz falso positivo em todo cliente que fecha no fim de semana.

Implemente com máquina de estados, inferindo o estado inicial: se o primeiro evento de armar/desarmar do período for um desarme, o sistema estava **armado** no início.

### 2.3 Sinais complementares de uso — exibir, não pontuar

Mostrar no painel da auditoria, porque contam a história para a conversa com o cliente:

- Usuários distintos que operaram a central no período (se caiu de 5 para 1, a conta está encolhendo)
- Dia da semana e horário típico de ativação
- Comparativo com o ciclo anterior

---

## PARTE 3 — Pilar ENTREGA

Começa em 100. Descontos:

| Situação | Desconto | Teto |
|---|---|---|
| OS aberta há mais de 30 dias | −20 por OS | 40 |
| OS fechada depois da data de `Previsão` | −10 por OS | 30 |
| Falha reincidente: mesma causa em 2 ciclos consecutivos | −20 | — |
| Preventiva vencida (fora da periodicidade contratada) | −15 | — |
| **Lacuna de captura confirmada** — padrão exigia chamado e não houve (Parte 14) | −10 por lacuna | 30 |

Piso 0.

**Cada fato desconta uma vez só.** OS aberta há mais de 30 dias e OS fora do prazo já descontam nas duas primeiras linhas — quando viram lacuna atribuída ao PCP na Parte 14, elas **não descontam de novo**; a lacuna só acrescenta a atribuição de setor. A última linha vale apenas para a lacuna que ainda não era medida: o padrão existia no log e nenhum chamado foi aberto.

Este pilar mede **a Rota Smart, não o cliente**. Quando ele cai, a tratativa é interna: vai para o PCP, não para o cliente. Deixe isso explícito na interface — o auditor não deve abrir plano de ação com o cliente por causa de nota baixa aqui.

---

## PARTE 4 — Pilar CONDIÇÃO

Começa em 100, menos as etiquetas marcadas. Três pesos apenas:

| Criticidade | Desconto |
|---|---|
| ALTA | −15 |
| MÉDIA | −10 |
| BAIXA | −5 |

Piso 0. Não há teto: se o cliente acumular achados crônicos suficientes para zerar, a nota zero é a informação correta.

### 4.1 Catálogo — 12 etiquetas

Só entra aqui o que o monitoramento **não vê** ou **não trata como defeito crônico**.

**CFTV — verificação manual do auditor**

| Código | Etiqueta | Criticidade | Critério objetivo | Foto |
|---|---|---|---|---|
| C-01 | Câmera offline não resolvida | ALTA | Câmera sem imagem **e** sem OS aberta, ou com OS aberta há mais de 7 dias. Câmera offline com OS recente é caso do monitoramento, não achado de auditoria. | Sim |
| C-02 | Visualização noturna comprometida | ALTA | Em imagem do período noturno, não é possível identificar pessoa ou veículo: infravermelho inoperante, ofuscamento ou iluminação insuficiente | Sim |
| C-03 | Gravação ou retenção abaixo do contratado | ALTA | Dias de gravação disponíveis menores que o contrato | Sim |
| C-04 | Lente suja ou obstruída | MÉDIA | Poeira, teia de aranha, respingo, vegetação ou objeto sobre a lente ou no campo de visão | Sim |
| C-05 | Enquadramento divergente do projeto | MÉDIA | Câmera cobrindo área diferente da contratada | Sim |

**Alarme — padrões crônicos detectados no log**

| Código | Etiqueta | Criticidade | Critério objetivo |
|---|---|---|---|
| A-01 | Violação noturna recorrente sem causa apurada | ALTA | 2 ou mais violações entre 22h e 06h no período, sem tratativa registrada |
| A-02 | Zona dispara na ativação | MÉDIA | 3 ou mais violações da mesma zona em até 5 minutos após o armamento — tempo de saída insuficiente ou sensor desalinhado |
| A-03 | Horário de ativação divergente do cadastrado | MÉDIA | 10 ou mais eventos `AF01 - NÃO ARMADO` no período: o horário programado não corresponde à rotina do cliente e gera alerta falso diário na central |
| A-04 | Zona anulada há mais de 7 dias | MÉDIA | Zona em bypass permanente sem justificativa registrada |

**Cadastro e operação**

| Código | Etiqueta | Criticidade | Critério objetivo |
|---|---|---|---|
| G-01 | Usuário não cadastrado operando a central | ALTA | 1 ou mais eventos com auxiliar `NÃO CADASTRADO`: a central não identifica quem armou, desarmou ou acionou pânico |
| G-02 | Contatos de emergência desatualizados | MÉDIA | 1 ou mais contatos inválidos na validação da auditoria |
| G-03 | Desarme fora do horário recorrente | BAIXA | 3 ou mais eventos `AF02 - DESARME FORA DO HORÁRIO` no período |

### 4.2 Estrutura da etiqueta

```
etiqueta { id, codigo, nome, pilar, criticidade, criterio, exige_foto, ativa }
```

`pontos` é **derivado** da criticidade, não digitado. Na tela de Configurações o admin edita os três valores de criticidade (15/10/5), não o ponto de cada etiqueta. Isso mantém a régua coerente e impede que alguém suba uma etiqueta isolada para 30 pontos.

Nunca excluir etiqueta usada em histórico — desativar.

---

## PARTE 5 — Faixas e filas

### 5.1 Faixa da conta

```
faixa = pior das três notas
  ≥ 75  →  Saudável
50 a 74  →  Atenção
  < 50  →  Risco
```

Uma nota `N/A` (perfil 24 horas no pilar Uso) é ignorada no cálculo.

### 5.2 A fila se divide por dono

Não existe uma fila de tratativa única. Cada pilar que cai abaixo de 75 gera um item na fila do responsável:

| Pilar abaixo de 75 | Fila | Dono | Prazo |
|---|---|---|---|
| USO | Contas em baixo uso | Comercial / relacionamento | 15 dias |
| ENTREGA | Pendências de atendimento | PCP / planejamento | 7 dias |
| CONDIÇÃO | Manutenção técnica | Técnica | 15 dias, ou 7 se faixa Risco |

Na simulação com base típica, cerca de um terço dos clientes fica fora de Saudável, e a divisão fica em torno de 56% puxados por Uso, 35% por Entrega e 9% por Condição. Volume absorvível porque são três donos diferentes — o que inviabilizaria seria tudo cair no OPS.

Exiba no Dashboard o tamanho das três filas separadamente. É o indicador que diz onde está o problema da operação naquele ciclo.

---

## PARTE 6 — Alerta de queda de uso (o detector de churn)

Fila própria, **fora do score e fora das faixas**.

```
Gatilho: USO caiu 15 pontos ou mais em relação ao ciclo anterior do mesmo cliente
```

Cliente que foi de 100 para 80 continua Saudável pela faixa, mas caiu 20 pontos e entra nesta fila. É exatamente o cliente que está saindo em silêncio e que a faixa não pegaria.

A tela `Contas em queda de uso` lista: cliente, USO do ciclo anterior, USO atual, variação, tendência dos últimos 3 ciclos, e data do último contato comercial. Ordenar por maior queda.

Só funciona a partir do ciclo 2. No ciclo 1, exibir a tela vazia com a mensagem *"Disponível a partir do segundo ciclo, quando houver comparação"*.

---

## PARTE 7 — As duas fontes automáticas

### 7.1 Log de eventos do alarme (PDF, CSV, TXT ou XLSX)

Relatório `RELAÇÃO DE EVENTOS POR PERÍODO`, por cliente.

Cabeçalho — extrair `codigo_cliente`, `nome`, `periodo_inicio`, `periodo_fim`:
```
00 - 0002 | PROCURADORIA GERAL DE JUSTICA - PROMOTORIA DE SÃO LUIZ GONZAGA
01/08/2026 00:00:00 ATÉ 31/08/2026 23:00:00
```

Linhas — `data_hora | codigo - descricao | auxiliar`. Ordem decrescente por data.

**Dicionário de eventos** (tabela editável; código desconhecido é importado e listado como "não classificado", nunca descartado em silêncio):

| Código | Descrição | Uso |
|---|---|---|
| 3401 / 3407 | Central armada pelo usuário / remotamente | Máquina de estados → ARMADO |
| 1401 | Desarmado pelo usuário | Máquina de estados → DESARMADO |
| AF01 | Não armado | Conta para A-03 |
| AF02 | Desarme fora do horário | Conta para G-03 |
| 1130 | Violação | Conta para A-01 e A-02 |
| 3130 | Restauração de zona violada | Fecha a violação |
| 1122 | Pânico acionado | Exibir; verificar se o usuário é cadastrado |
| 1602 | Auto-teste | Só para validar integridade do arquivo, **não pontua** |
| 1410 | Configuração remota | Exibir |

> O auto-teste não entra no score. Dia sem auto-teste é falha de comunicação, e isso a central já tratou em tempo real. Se aparecer, exibir como aviso na importação — *"3 dias sem comunicação no período; confirme se houve OS"* — para alimentar o pilar Entrega, não o Condição.

**Indicadores derivados:** `noites_protegidas`, `usuarios_distintos`, `usuarios_nao_cadastrados`, `eventos_af01`, `eventos_af02`, `violacoes_noturnas`, `violacoes_na_ativacao_por_zona`, `panicos`.

**Período:** usar o período do cabeçalho como janela de apuração e gravá-lo. Se estiver fora de 28 a 31 dias, normalizar os contadores para base 30 dias e avisar. Sem isso, um cliente exportado com 60 dias é penalizado em dobro sem ninguém perceber.

### 7.2 Planilha de ordens de serviço (XLSX)

Colunas usadas: `Ordem`, `Status`, `Tipo`, `Abertura`, `Previsão`, `Fechamento`, `Cliente`, `Fantasia`, `Técnico`, `Defeito`, `Causa`, `Prioridade`, `Problema Execução`, `Cidade do Cliente`.

`SLA Atendimento` e `SLA Fechamento` vêm vazios — o SLA é **calculado**: `atraso = Fechamento − Previsão`.

**Classificação por `Tipo`:**

| Tipo | Conta como |
|---|---|
| `Corretiva` | Manutenção corretiva |
| `Preventiva` | Preventiva — alimenta a verificação de preventiva em dia, **não penaliza** |
| `Interna` | Atendimento; ver regra de deslocamento abaixo |
| `Ampliação` · `Retirada` | Comercial — fora do score |

**Deslocamento real é definido pelo campo `Técnico`, não pelo `Tipo`:** `ATENDIMENTO REMOTO`, `ANALISE DE O.S`, `ANALISE`, `ANALISE OPS` e `CADASTRO COLABORADOR` **não** são deslocamento. No arquivo de referência, 170 OS eram do tipo `Interna`, mas 46 eram atendimento remoto e 59 análise interna — contar por `Tipo` superestima o deslocamento em mais de 60%.

**Alerta obrigatório na importação:** `Causa = FECHADO EM ANALISE`. No arquivo de referência são 105 de 280 OS (37,5%) fechadas sem causa raiz registrada. Exibir o número e listá-las. Sem causa, não há análise de reincidência — e reincidência é um dos quatro descontos do pilar Entrega.

**Exportar sempre com todos os status.** O Service permite extrair `Aberta`, `Em atendimento` e `Fechada` no período — sempre exporte assim. O arquivo de referência veio só com `Fechada`, o que esconde exatamente o pior caso: o cliente com OS parada há 90 dias não aparece.

**O status não é detalhe — ele diz de quem é a falha:**

| Status | Significa | Responsável quando atrasa |
|---|---|---|
| `Aberta` | Chamado existe, ninguém programou ainda | **PCP** — não agendou |
| `Em atendimento` | Programado ou em execução, não concluído | **Técnica** — não fechou |
| `Fechada` | Encerrado | Avaliar se fechou dentro do prazo e se resolveu |

Sem essa distinção, uma OS parada 50 dias seria atribuída ao mesmo setor nos dois casos, quando são problemas diferentes: uma não saiu da fila, a outra saiu e não terminou.

Gravar `dias_no_status_atual` para cada OS aberta ou em atendimento.

**Janela:** contar a OS que esteve ativa em qualquer momento do período — `Abertura <= fim` e (`Fechamento >= inicio` ou `Status = Aberta`).

---

## PARTE 8 — Checklist manual de CFTV

O CFTV não tem fonte automática. Para ser comparável entre auditores, é checklist fechado, nunca campo livre. Exibir só quando o cliente tiver CFTV contratado.

| Pergunta | Respostas | Gera |
|---|---|---|
| Todas as câmeras estão online? | `Sim` · `Não — N de M offline` | `Não` → verificar se há OS; sem OS ou OS com mais de 7 dias → **C-01** |
| A gravação está disponível e dentro da retenção contratada? | `Sim` · `Gravação indisponível` · `Retenção abaixo do contrato` | → **C-03** |
| As lentes estão limpas e desobstruídas? | `Sim` · `Não — poeira` · `Não — teia de aranha` · `Não — vegetação ou objeto` | → **C-04** |
| A visualização noturna permite identificar pessoa e veículo? | `Sim` · `Não — infravermelho inoperante` · `Não — ofuscamento` · `Não — iluminação insuficiente` | → **C-02** |
| O enquadramento corresponde ao projeto? | `Sim` · `Não` | → **C-05** |

Regras:
- **Foto obrigatória** em qualquer resposta negativa.
- A verificação noturna exige **imagem do período noturno**, gravada ou ao vivo. Registrar data e hora da imagem avaliada, para ninguém julgar visão noturna vendo imagem de dia.
- Guardar as respostas estruturadas em `checklist_cftv`, não só a etiqueta resultante. Assim dá para responder "quantos clientes da base têm teia de aranha em câmera" sem reabrir auditoria.

---

## PARTE 9 — Fluxo do lançamento

O auditor trabalha da mesa, um cliente por vez, com dois arquivos pequenos. O upload acontece **dentro da tela de Lançamento**, não em tela separada.

Abaixo da Identificação, bloco `Fontes de dados` com duas áreas de arrastar-e-soltar: log de eventos e ordens de serviço. Processar ao soltar, sem botão intermediário.

**Conferência que bloqueia antes de preencher qualquer campo:**

| Conferência | Ação |
|---|---|
| Código do cliente no log = código na planilha = cliente selecionado | **Bloqueia.** *"O log é do cliente 0002 e a planilha é do 0009."* |
| Períodos do log e das OS se sobrepõem | **Bloqueia** se não houver sobreposição |
| Período do log entre 28 e 31 dias | **Avisa** e normaliza |

Essa trava impede o erro mais provável do dia a dia: exportar o arquivo de um cliente e lançar em outro. Sem ela, ninguém percebe.

**Resumo exibido após a leitura**, sempre com o número que gerou a conclusão:

```
✓ LOG · cliente 0002 · 01/08 a 31/08/2026 · 247 eventos
   Noites protegidas: 31 de 31  →  USO 100
   Usuários distintos: 4  ·  não cadastrados: 4 (000, 063, 106, 201)
   Violações: 14 → zona 008: 9 (todas até 2 min após armar) · zona 002: 5 (4 de madrugada)
   AF01: 26  ·  AF02: 6  ·  Pânico: 1 (usuário não cadastrado)

✓ ORDENS DE SERVIÇO · cliente 0002 · 3 OS
   Corretivas 1 · Preventivas 1 · Remotos 1 · Abertas há +30 dias: 0
   SLA: 1 OS fechada 6 dias após a previsão  →  ENTREGA 90
   ⚠ 1 OS sem causa raiz ("FECHADO EM ANALISE")

Etiquetas sugeridas: A-01 · A-02 · A-03 · G-01 · G-03      →  CONDIÇÃO 45
```

Cada campo preenchido por arquivo exibe `importado`. Se o auditor alterar, passa a `ajustado manualmente`, gravando valor anterior, autor e justificativa em uma linha.

**Sem arquivo, a tela funciona inteira no manual.** A importação acelera, nunca é pré-requisito — importa no dia em que o sistema de monitoramento estiver fora do ar.

Sequência: selecionar cliente → soltar os dois arquivos → conferir resumo e etiquetas sugeridas → responder o checklist de CFTV com fotos → revisar parecer → `Salvar e próximo cliente`. Meta de 3 a 5 minutos por auditoria.

---

## PARTE 10 — Ciclo, meta e região

### 10.1 Reset
Os 4 ciclos e as 6 auditorias gravados são teste. **Apagar tudo** — auditorias, ciclos, planos de ação. Os 542 clientes permanecem. Criar o `Ciclo 1` limpo.

### 10.2 Ciclo fecha por cobertura
2 auditores × 10 auditorias por dia útil = 20/dia. Para 542 clientes: **27 dias úteis por ciclo**, cerca de 9 ciclos por ano.

```
ciclo { numero, data_inicio, data_fim, meta_clientes (542), meta_diaria (20),
        prazo_alvo_dias (30 dias úteis), status }
```

Fecha automaticamente ao atingir a cobertura. Não permitir ciclo novo com o anterior aberto. Cada cliente auditado uma vez por ciclo.

**KPIs de ritmo** no Dashboard, substituindo o card "Auditorias no mês — meta 20":
- `RITMO DE HOJE` — `X / 20`, com quebra por auditor
- `COBERTURA DO CICLO` — `X / 542 (Y%)` com barra
- `PROJEÇÃO DE FECHAMENTO` — data prevista pela média dos últimos 5 dias úteis, comparada ao prazo-alvo

### 10.3 Ordem por região, ancorada na quinta-feira

O planejamento de viagem acontece **toda quinta-feira**. A fila de auditoria é hierárquica: `Base operacional → Cidade → Cliente`, e uma região é auditada dentro de uma mesma semana, para a demanda dela chegar inteira na quinta.

Cadastros novos:
```
base_operacional  { id, nome, cidade_sede, uf, ativa }
cidade_atendimento { id, nome, uf, base_operacional_id, distancia_km }
```
No cliente, gravar `cidade_atendimento_id`. Trabalho único de associação cidade → base, algo entre 60 e 100 linhas, populado a partir da cidade já cadastrada.

**Ordem das regiões:** no ciclo 1, pelas maiores primeiro. Do ciclo 2 em diante, **pela pior média de faixa do ciclo anterior**, para a região mais problemática não cair no dia 25.

### 10.4 Painel de demanda regional — alimentado pela planilha de OS, não pela auditoria

Tela para o planejamento consultar na quarta-feira. O app **não gera OS**: o auditor abre no Service, a Samantha exporta e a planilha volta para cá.

Por base operacional, uma linha por cidade: OS abertas, idade da mais antiga, ações de manutenção pendentes da auditoria, e **clientes daquela cidade ainda não auditados no ciclo**.

Esta última coluna é a única informação que nem o Service nem o planejamento têm hoje, e é a que responde a pergunta que causa viagem redundante: *vale esperar, ou já auditei tudo dessa cidade?*

> **Correção de dimensionamento, importante:** a auditoria gera poucas manutenções — pela simulação, algo como 15 a 20 por ciclo em toda a base, porque a maior parte dos achados é de Uso e de Entrega, não de Condição. As 169 OS com deslocamento medidas em agosto vieram quase todas do monitoramento, não de auditoria. Então **o painel regional só tem valor se mostrar toda a demanda** — a do monitoramento junto com a da auditoria. Como a planilha de OS traz tudo, isso sai de graça. Consolidar viagem olhando só o que a auditoria gera renderia pouco.

---

## PARTE 11 — Travas de integridade

**Snapshot de parâmetros.** Alterar um peso hoje recalcula todo o histórico e os scores passados mudam sozinhos, o que destrói a comparação entre ciclos — e a comparação entre ciclos é o coração do detector de churn. Criar `parametros_versao`, gravar o `parametros_versao_id` e as três notas congeladas em cada auditoria. Ao salvar parâmetros: *"Nova versão criada. Auditorias já lançadas mantêm a pontuação original."*

**Auditor travado no usuário logado.** O histórico tem auditores gravados como `kkk`, `TGDRW` e `Teste E2E` — campo de texto livre. Tornar somente leitura, preenchido com o usuário autenticado.

**Amostra mínima.** Não exibir média do ciclo com cobertura abaixo de 10%; mostrar `—` e `amostra insuficiente (N/542)`. Usar mediana, não média. No ranking, exibir a data da auditoria e ocultar quem tem mais de 90 dias.

**Parecer obrigatório** para qualquer auditoria em faixa Risco.

**Re-auditoria de verificação.** Clientes que fecharem em Risco entram em fila de re-auditoria 7 dias após o prazo da tratativa, sem esperar o ciclo seguinte. Marcar `tipo = REAUDITORIA` para não contar na cobertura. No histórico do cliente, exibir o par (nota na auditoria → nota na re-auditoria) — é o indicador que prova a eficácia do processo para a direção.

---

## PARTE 12 — Velocidade da tela de Lançamento

A 10 auditorias por auditor por dia, cada lançamento precisa fechar em poucos minutos:

- Navegação por teclado completa; atalho para marcar etiqueta digitando o código (`A-02` + Enter)
- Autocomplete de cliente por código e nome a partir do 2º caractere
- Botão `Salvar e próximo cliente`, que já abre o próximo pendente da região
- Indicador `Cliente 7 de 20 do seu dia`
- Rascunho automático a cada alteração
- Parecer técnico com sugestão pronta por combinação de etiquetas, editável

---

## PARTE 13 — Casos de teste

| # | Cenário | Esperado |
|---|---|---|
| 1 | 31 de 31 noites protegidas, 0 OS, checklist CFTV todo `Sim`, sem padrões no log | USO 100 · ENTREGA 100 · CONDIÇÃO 100 · **Saudável** |
| 2 | Cliente armou sex e desarmou seg; sáb e dom sem nenhum evento de ativação | `noites_protegidas` conta sáb e dom. **Se der falha, a máquina de estados está implementada como contador** |
| 3 | Perfil `24_HORAS`, 0 noites armadas, resto OK | USO `N/A` · faixa calculada só por Entrega e Condição |
| 4 | 12 de 30 noites, resto perfeito | USO 40 · **Risco** · fila `Contas em baixo uso`, dono Comercial |
| 5 | USO 100, 2 OS abertas há mais de 30 dias e 1 fora do prazo | ENTREGA 50 · **Atenção** · fila PCP, **sem** plano de ação com o cliente |
| 6 | Log do cliente 0002 de agosto/2026 (11 páginas) | `noites_protegidas` 31 · `usuarios_nao_cadastrados` 4 · `violacoes_na_ativacao` 9 na zona 008 · `eventos_af01` 26 · `eventos_af02` 6 · etiquetas A-01, A-02, A-03, G-01, G-03 · CONDIÇÃO 45 |
| 7 | Cliente com USO 100 no ciclo anterior e 80 neste | Faixa continua **Saudável**, e ele aparece em `Contas em queda de uso` com −20 |
| 8 | Log do cliente 0002 + planilha do cliente 0009 | Importação **bloqueada** com mensagem nomeando os dois códigos |
| 9 | Log com 9 violações na ativação (RC-01) e nenhuma OS do cliente na janela | Lacuna `SUSPEITA`, setor Monitoramento. **Não desconta nada até o auditor confirmar** |
| 10 | Mesma situação, e o auditor marca `IMPROCEDENTE_OS_EXISTE` com o número da OS | Lacuna sai do painel de setor · ENTREGA inalterada · soma ao contador de "OS ausente na exportação" |
| 11 | 2 lacunas de Monitoramento confirmadas + 1 OS aberta há 40 dias (RC-08) | ENTREGA = 100 − 20 (OS antiga) − 20 (2 lacunas) = 60. **A lacuna do PCP pela mesma OS não desconta de novo** |
| 12 | Setor com 3 oportunidades no ciclo | Taxa exibida como `—` · `amostra insuficiente` |
| 13 | OS com sistema offline, prazo de 2 dias, status `Aberta` há 50 dias | Lacuna RC-08 · setor **PCP** · fator 25 → **CRÍTICA** · notificação imediata ao coordenador · entra no topo da fila dele no mesmo dia |
| 14 | Mesma OS, mas status `Em atendimento` há 50 dias | Lacuna RC-09 · setor **Técnica**, não PCP. O status decide o responsável |
| 15 | OS fechada por técnico de análise, sem deslocamento, e a zona voltou a disparar 9 dias depois | Lacuna RC-11 · setor PCP · fechamento sem solução |
| 16 | Ciclo 1 em andamento, lacuna crítica confirmada no 2º dia | Aparece na fila do coordenador **imediatamente**. O painel comparativo entre setores continua restrito até o ciclo 2 |
| 17 | CSV do Sowil com `CENTRAL OFFLINE`, sem viatura e sem `NO LOCAL` | **Não conta** como deslocamento. Entra em `tarefas_sem_ida`, indicador positivo do monitoramento |
| 18 | Duas linhas `RONDA PRESENCIAL` com `NO LOCAL` preenchido | Contam em `rondas_presenciais`, **fora** da conta de custo por falha |
| 19 | Cliente 0073: dois deslocamentos por violação no mesmo dia, permanências de 16m18s e 1m40s | 2 procedentes · o de 1m40s marcado `permanência insuficiente` e selecionado para conferência de PTR |
| 20 | 4 deslocamentos por violação no período, nenhuma OS técnica aberta, log com A-02 já marcada | Lacuna **RC-19** (Monitoramento) · A-02 sobe de MÉDIA para ALTA · **sem desconto extra por deslocamento** |
| 21 | 3 deslocamentos por violação, log sem padrão que explique | Etiqueta **A-05** em CONDIÇÃO |
| 22 | CSV aberto como UTF-8 | Nome do cliente com acento corrompido não casa com o cadastro — abrir como **cp1252** |

---

## PARTE 14 — Lacunas de captura e painel de falhas por setor

Segundo eixo da auditoria, independente da saúde do cliente. Enquanto os três pilares perguntam *como está esta conta*, este eixo pergunta **se cada área fez o que o procedimento manda**.

O caso típico: o log mostra que em 9 dias o cliente armou e a zona 008 violou em menos de 2 minutos. O procedimento do monitoramento manda abrir chamado técnico a partir do terceiro caso. Se não existe chamado, isso não é problema do cliente nem defeito de equipamento — é **falha de procedimento do time de monitoramento**, e é assim que precisa chegar ao gestor dele.

### 14.1 O procedimento vira tabela no app

O procedimento já é documentado e conhecido. Transcreva-o para dentro do sistema, para que a comparação seja contra a regra real da Rota Smart e não contra um critério inventado pelo app.

```
regra_captura {
  id, codigo, descricao,
  setor_responsavel,        -- MONITORAMENTO | PCP | TECNICA | COMERCIAL | OPS
  gatilho_campo,            -- indicador derivado do log ou da planilha de OS
  gatilho_operador,         -- >=  >  ==
  gatilho_valor,
  acao_esperada,            -- "abrir chamado técnico"
  prazo_esperado_dias,      -- em quantos dias a ação deveria ter ocorrido
  documento_referencia,     -- onde está escrito (nº do POP, instrução de trabalho)
  ativa
}
```

O campo `documento_referencia` não é burocracia: quando a auditoria apontar a lacuna, o gestor vai perguntar onde está escrito, e o app responde na hora. Sem ele, a conversa vira discussão de versão.

**Seed — confirmar cada gatilho contra o procedimento vigente antes de ativar:**

| Código | Gatilho | Ação esperada | Setor |
|---|---|---|---|
| RC-01 | 3+ violações da mesma zona em até 5 min após armar | Abrir chamado técnico | Monitoramento |
| RC-02 | 1+ violação entre 22h e 06h | Registrar tratativa da ocorrência | Monitoramento |
| RC-03 | 1+ evento com usuário `NÃO CADASTRADO` | Abrir chamado de cadastro | Monitoramento |
| RC-04 | 10+ eventos `AF01 - NÃO ARMADO` | Abrir chamado de ajuste de horário programado | Monitoramento |
| RC-05 | 1+ dia sem comunicação no período | Abrir manutenção | Monitoramento |
| RC-06 | Zona anulada há mais de 7 dias | Abrir chamado | Monitoramento |
| RC-07 | Pânico acionado por usuário não cadastrado | Tratativa e regularização de cadastro | Monitoramento |
| RC-08 | OS em status `Aberta` além do prazo do chamado | Programar atendimento | PCP |
| RC-09 | OS em status `Em atendimento` além do prazo do chamado | Concluir o atendimento | Técnica |
| RC-10 | OS fechada após a data de `Previsão` | Cumprir o prazo | PCP |
| RC-11 | OS fechada sem deslocamento e o padrão que a originou reapareceu no log em até 15 dias | Fechamento sem solução — reabrir | PCP |
| RC-12 | Mesma causa reincidindo em 2 ciclos consecutivos | Reparo definitivo | Técnica |
| RC-13 | Cliente com USO abaixo de 75 sem contato registrado no ciclo | Contato de relacionamento | Comercial |
| RC-14 | Cliente na fila de queda de uso sem contato registrado | Contato de relacionamento | Comercial |
| RC-15 | Auditoria em faixa Risco salva sem parecer técnico | Preencher parecer | OPS |
| RC-16 | Etiqueta com foto obrigatória salva sem anexo | Anexar evidência | OPS |
| RC-17 | Re-auditoria não realizada dentro do prazo | Executar re-auditoria | OPS |
| RC-18 | Cliente do ciclo não auditado no fechamento | Concluir cobertura | OPS |

As quatro últimas medem a própria auditoria. **Não são opcionais.** Um painel que só aponta para fora do OPS vira arma e será tratado como tal; um painel que também mede quem o opera vira sistema de qualidade.

### 14.2 Detecção: o app suspeita, o auditor confirma

```
lacuna {
  id, auditoria_id, cliente_id, regra_captura_id, setor_responsavel,
  evidencia,              -- o número que disparou: "9 violações na ativação, zona 008"
  data_gatilho,
  prazo_esperado_dias,
  atraso_dias,            -- dias decorridos além do prazo esperado
  gravidade,              -- CRITICA | ALTA | MEDIA | BAIXA (calculada, ver 14.3)
  status,                 -- SUSPEITA | CONFIRMADA | IMPROCEDENTE_OS_EXISTE | IMPROCEDENTE_NAO_SE_APLICA
  os_referencia, justificativa,
  verificado_por, verificado_em,
  encaminhada_em, coordenador_ciente_em
}
```

Como o app decide que há suspeita: o gatilho foi atingido em determinada data e **não existe OS para aquele cliente, em nenhum status, dentro do `prazo_esperado_dias`** a partir dela.

O casamento é por **cliente e janela de tempo**, não pela causa da OS. Isso é deliberado: no arquivo de referência, 37,5% das OS fecham com causa `FECHADO EM ANALISE`, e casar por causa geraria lacuna falsa em mais de um terço dos casos. Qualquer OS do cliente na janela conta como capturada, salvo julgamento do auditor.

**A confirmação do auditor continua obrigatória, mas fica leve.** Com a exportação completa de status, a maioria dos gatilhos vai casar com uma OS existente e nem chega a virar suspeita. O que sobra são poucos casos por cliente, e o auditor só precisa julgar o que restou — não revisar tudo. O julgamento humano permanece porque o casamento é temporal e ainda existem exceções legítimas: cliente que pediu para não abrir, item fora de contrato, gatilho mal transcrito.

Quando o auditor classificar como `IMPROCEDENTE_OS_EXISTE`, o app conta isso separadamente. Com a exportação completa, esse contador deve ficar perto de zero — se subir, o problema é o dado, não o setor acusado.

### 14.3 Gravidade da lacuna e fila do coordenador

Uma OS de sistema offline com prazo de 2 dias parada há 50 dias e uma lacuna de cadastro de usuário não são a mesma coisa. A gravidade sai da razão entre o atraso e o prazo da própria regra:

```
fator = atraso_dias ÷ prazo_esperado_dias

fator >= 10   →  CRITICA      (ex.: prazo 2 dias, parada há 50 → fator 25)
fator >=  5   →  ALTA
fator >=  2   →  MEDIA
fator  <  2   →  BAIXA
```

Sobe para CRÍTICA independente do fator quando o cliente está sem proteção no período — sistema offline, gravação indisponível, ou USO abaixo de 50.

**A fila do coordenador não espera o fechamento do ciclo.** Toda lacuna confirmada entra imediatamente na tela `Pendências do meu setor`, ordenada por gravidade e depois por atraso. Cada coordenador vê a sua. Lacuna CRÍTICA dispara notificação no ato da confirmação, sem aguardar nada.

A tela mostra, por lacuna: cliente, o que o log ou a planilha apontou, qual regra e qual documento, o prazo, há quantos dias está aberta e a ação esperada. O coordenador marca ciência e registra a orientação dada. O app grava `coordenador_ciente_em` — que também é medida: lacuna crítica sem ciência em 48h vira pendência do próprio coordenador.

Esta tela é o produto principal da Parte 14. A taxa da seção seguinte é leitura gerencial de tendência, não substitui a fila.

### 14.4 Taxa de captura

```
oportunidades   = vezes que um gatilho foi atingido no ciclo
lacunas         = oportunidades sem a ação esperada, confirmadas pelo auditor
taxa de captura = (oportunidades − lacunas) ÷ oportunidades × 100
```

A taxa serve para **tendência e comparação entre ciclos**, não para substituir o caso. Um setor que processa 380 oportunidades e outro que processa 40 não se comparam por contagem absoluta, e sem denominador ninguém sabe se o mês foi melhor ou pior que o anterior. Exibir a taxa como número principal do painel e a contagem ao lado.

Quando o denominador do ciclo for menor que 20, exibir `—` com a legenda `amostra insuficiente`. Taxa sobre 3 oportunidades não diz nada.

### 14.5 Painel de falhas por setor

Leitura gerencial, por ciclo. A fila operacional é a da seção 14.3.

| Setor | Taxa de captura | Oportunidades | Lacunas | Tendência (3 ciclos) | Principal tipo |
|---|---|---|---|---|---|
| Monitoramento | 96% | 380 | 14 | ↑ 92 → 94 → 96 | RC-03 · usuário não cadastrado (8) |
| PCP | 88% | 74 | 9 | ↓ 94 → 91 → 88 | RC-09 · fechamento fora do prazo (7) |
| Técnica | 93% | 41 | 3 | → 93 → 92 → 93 | RC-10 · reincidência (3) |
| Comercial | 61% | 103 | 40 | — | RC-11 · sem contato em baixo uso (31) |
| OPS / Auditoria | 97% | 542 | 16 | ↑ 89 → 94 → 97 | RC-14 · foto faltando (11) |

Drill-down por setor: lista das lacunas confirmadas com cliente, data, evidência e regra violada.

**Agregar por setor, nunca por operador no painel geral.** O log traz nome de operador em alguns eventos e a tentação de descer ao indivíduo é grande, mas é o que transforma melhoria de processo em caça a pessoa. Leitura por operador, se for necessária, só dentro do painel do próprio gestor daquele setor.

### 14.6 O que espera o ciclo 2 e o que não espera

**A fila de pendências por setor (14.3) não espera nada.** Vale desde a primeira auditoria do ciclo 1. Segurar por 27 dias um chamado de 50 dias com sistema offline para "validar metodologia" seria indefensável — o caso é concreto, tem documento de referência e o coordenador precisa dele hoje.

**O que espera o ciclo 2 é a taxa comparativa entre setores (14.4 e 14.5).** O procedimento é documentado, mas o método de detecção é novo: gatilho mal transcrito, janela curta demais, exceção legítima não prevista. Publicar ranking de setores com o método ainda verde queima a credibilidade do painel inteiro — e aí o caso individual, que é o que importa, passa a ser contestado junto.

No ciclo 1, cada coordenador vê a sua própria taxa e as suas próprias lacunas; a comparação entre setores fica restrita a você. A partir do ciclo 2, com os gatilhos conferidos contra o procedimento e os falsos positivos do primeiro ciclo corrigidos, o painel comparativo abre.

Flag de configuração `painel_setor_comparativo_liberado`, não código temporário.

---

## PARTE 15 — Deslocamentos de pronto atendimento (terceira fonte automática)

Clientes com pronto atendimento geram deslocamento de viatura. Cada ida custa, e ida repetida pelo mesmo motivo é custo que não deveria existir: se a zona dispara em falso toda noite, a solução é chamado técnico, não mandar carro sete vezes.

Esta parte fecha o ciclo da Parte 14 com a evidência mais forte que existe — não só o evento aconteceu, mas **pagamos para ir lá**.

### 15.1 A chave que une as três fontes

| Fonte | Campo do código da conta | Exemplo |
|---|---|---|
| Log de eventos | cabeçalho, após a empresa | `0002` |
| Sowil — deslocamentos | coluna `PC` | `1114` |
| Service — ordens de serviço | coluna `Chaves` | `1114` |

`PC` e `Chaves` são o mesmo código de conta de monitoramento — verificado: 1114 é `AGROFEL SANTO ANGELO` no Sowil e `SANTO ANGELO - ESCRITORIO` no Service. A coluna `Cliente` do Service (`011485`) é o código comercial, outro sistema.

No cadastro, gravar `codigo_monitoramento` (4 dígitos, chave de junção das três fontes) e `codigo_comercial` como atributo. **A junção é sempre pelo código de monitoramento, nunca pelo nome** — o mesmo ponto aparece como "AGROFEL SANTO ANGELO" numa fonte e "SANTO ANGELO - ESCRITORIO" na outra.

### 15.2 O arquivo

CSV do Sowil, **encoding cp1252 (Latin-1), delimitador ponto e vírgula**, 19 colunas, campos com aspas duplicadas. Não assuma UTF-8: acento vem corrompido e o nome do cliente não casa.

| Coluna | Uso |
|---|---|
| `PC` | Código da conta — chave de junção |
| `CLIENTE` | Nome da unidade |
| `HORÁRIO RECEBIMENTO DA TAREFA` | Início da contagem de resposta |
| `DESLOCADO` | Saída da viatura |
| `TEMPO PARA INICIAR` | Recebimento → saída |
| **`NO LOCAL`** | **Chegada. Campo decisivo — ver 15.3** |
| `TEMPO EM DESLOCAMENTO` | Saída → chegada |
| `FINALIZADO` | Encerramento |
| `COD. EVENTO` · `GRUPO DE EVENTO` | Classificação do motivo |
| `VTR - PRONTO` | Viatura e agente |
| `OPERADOR` · `OPERADOR2` | Quem despachou |
| `LIBERADO FORA DO LOCAL` | **Ignorar completamente** |

`LIBERADO FORA DO LOCAL` não entra em nenhum cálculo: o app de campo falha na localização e permite registro fora do ponto, então o campo mede falha de GPS, não falha de procedimento. Não crie indicador, alerta nem coluna com ele.

`TEMPO TOTAL` vem vazio no arquivo — calcular: `FINALIZADO − HORÁRIO RECEBIMENTO`.

### 15.3 Regra de procedência

```
deslocamento procedente = NO LOCAL preenchido
                          E grupo de evento na lista de motivo-problema
```

**Sem `NO LOCAL`, desconsidere.** A tarefa existiu, mas ninguém foi: o monitoramento conseguiu contato e era o próprio cliente no local, ou cancelou a ida no meio do itinerário para atender ocorrência real. Isso é tratativa correta do monitoramento, acompanhada pelo gestor dele — não é deslocamento e não é falha.

**Grupos que contam como motivo-problema** (tabela editável):
`VIOLAÇÃO` · `PÂNICO` · `COAÇÃO` · `EMERGÊNCIA` · `FALHA DE ENERGIA` · `CENTRAL OFFLINE`

**`RONDA PRESENCIAL` (código `RP`) não é problema** — é serviço contratado e previsto. Contar em indicador separado, nunca na conta de custo por falha. Misturar ronda com disparo infla o número e esconde o que importa.

### 15.4 Indicadores derivados

Por cliente e período: `deslocamentos_procedentes`, `deslocamentos_por_grupo`, `rondas_presenciais`, `tarefas_sem_ida`, `tempo_medio_para_iniciar`, `tempo_medio_resposta` (recebimento → no local), **`permanencia_no_local`** por deslocamento (`FINALIZADO − NO LOCAL`).

`tarefas_sem_ida` é indicador **positivo** do monitoramento: resolveu sem mandar carro. Exiba como tal.

### 15.5 Permanência no local — o filtro que torna a conferência de PTR viável

No arquivo de exemplo, o cliente 0073 (CMI Máquinas São Borja Pátio) teve dois deslocamentos por violação no mesmo dia:

```
16/09 00:53 → no local 01:15:51 → finalizado 01:32:09    permanência 16m18s
16/09 19:00 → no local 19:09:59 → finalizado 19:11:39    permanência  1m40s
```

Mesmo cliente, mesmo tipo de evento, mesma noite. Um minuto e quarenta segundos não dá para fazer vistoria perimetral. Esse é o PTR que precisa ser conferido — e o app aponta sozinho.

Cadastro `permanencia_minima_por_grupo` (editável), com sugestão inicial a confirmar contra o procedimento: Violação 10 min · Pânico e emergência 15 min · Falha de energia 8 min · Ronda presencial 3 min. Abaixo do mínimo, marcar o deslocamento como `permanência insuficiente`.

### 15.6 Conferência de PTR — manual no Sowil, por amostra

As fotos e o relato ficam no Sowil; o auditor confere lá e registra o resultado aqui.

**Conferir todos é inviável.** Um cliente com 7 deslocamentos no período, a 3 minutos por PTR, consome 21 minutos — metade do orçamento de uma auditoria de 10 por dia. O app seleciona até **3 PTRs por auditoria**, nesta ordem:

1. O de menor permanência no local
2. O de maior tempo para iniciar
3. O mais recente

Com menos de 3 procedentes, conferir todos. Registrar quais foram conferidos, para a amostra girar entre ciclos.

Checklist por PTR conferido, resposta fechada:

| Pergunta | Respostas |
|---|---|
| Fotos registradas conforme o procedimento? | `Sim` · `Parcial` · `Não` |
| Vistoria perimetral realizada? | `Sim` · `Não` · `Não se aplica` |
| Relato do atendimento preenchido e coerente? | `Sim` · `Incompleto` · `Não` |
| A permanência no local é compatível com a vistoria relatada? | `Sim` · `Não` |

Guardar em `conferencia_ptr` ligado ao deslocamento. Qualquer `Não` gera lacuna do setor Pronto Atendimento.

### 15.7 Novas regras de captura (somam à tabela da Parte 14)

| Código | Gatilho | Ação esperada | Setor |
|---|---|---|---|
| RC-19 | 3+ deslocamentos procedentes do mesmo cliente e mesmo grupo de evento no período, sem OS técnica aberta | Abrir chamado técnico — carro não resolve defeito | Monitoramento |
| RC-20 | Deslocamento procedente com permanência abaixo do mínimo do grupo | Cumprir a vistoria conforme procedimento | Pronto Atendimento |
| RC-21 | Conferência de PTR com qualquer resposta `Não` ou `Parcial` | Corrigir registro e orientar o agente | Pronto Atendimento |
| RC-22 | Tempo para iniciar acima do prazo de pronto atendimento contratado | Cumprir o tempo de resposta | Pronto Atendimento |

**RC-19 é o caso que você descreveu:** sete deslocamentos em sete dias por disparo falso, sem chamado técnico aberto. O custo é da Rota Smart, a causa é técnica e a falha de procedimento é do monitoramento, que deveria ter aberto a OS na terceira ocorrência.

> **Setor novo:** `PRONTO_ATENDIMENTO` não estava na sua lista de cinco, mas decorre de auditar o procedimento do PTR — o time de viatura tem coordenador próprio e as lacunas RC-20 a RC-22 são dele, não do monitoramento. Confirme antes de ativar; se preferir, essas três podem ficar sob Monitoramento.

### 15.8 Onde o deslocamento entra no score — e onde não entra

**Deslocamento não é um quarto desconto.** Quando a zona 008 já foi penalizada na etiqueta A-02 pelo log, contar de novo os 9 deslocamentos que ela causou é punir duas vezes o mesmo fato — o erro que já corrigimos duas vezes neste projeto.

O deslocamento atua de três formas:

1. **Indicador de custo**, exibido ao lado das três notas, nunca dentro delas. O cliente não está doente porque mandamos carro; está doente porque o equipamento dispara em falso. O custo é nosso.
2. **Modulador de gravidade**: etiqueta cuja causa gerou deslocamento procedente sobe um nível de criticidade. Zona que dispara na ativação e custou 9 idas é pior que zona que só dispara.
3. **Gatilho de lacuna**, via RC-19.

**Exceção — uma etiqueta nova**, para quando o deslocamento é a única evidência:

| Código | Etiqueta | Criticidade | Critério |
|---|---|---|---|
| A-05 | Deslocamento recorrente sem causa identificada | MÉDIA | 3+ deslocamentos procedentes por violação no período **sem** A-01 ou A-02 já marcadas — há disparo custando ida e o log não explica por quê |

### 15.9 Painel de custo de atendimento

Por ciclo: ranking de clientes por `deslocamentos_procedentes`, com grupo de evento predominante, quantos têm OS técnica aberta e quantos não têm. A coluna `sem OS` é a fila de RC-19.

Agregar também por base operacional e por viatura — deslocamento concentrado em poucos clientes é problema técnico; espalhado é perfil de operação.

---

## O que saiu do v2, e por quê

| Removido | Motivo |
|---|---|
| Etiquetas de alarme sem comunicação, câmera offline sem OS, gravação indisponível aguda, falha de energia, rede instável, linha telefônica, sensor inoperante, bateria vencida, sirene inoperante, teclado queimado | A central 24/7 detecta e abre OS em horas. O auditor estaria reanotando o que já foi resolvido. Viraram verificação de entrega: só contam quando a OS está velha ou a falha voltou. |
| Score único de 0 a 100 | Misturava três problemas com três donos diferentes e escondia qual era. |
| 5 faixas de classificação | A decisão é ternária: está bem, precisa de atenção, precisa de ação. |
| Cap de criticidade em 74 | Existia para impedir que falha crítica ficasse verde. Falha crítica é do monitoramento — não chega na auditoria. |
| 4 níveis de criticidade e 3 de troféu | Reduzidos a 3 pesos. Sete números configuráveis viraram três. |
| Troféus | Reconhecimento não precisa entrar na conta. Cliente com as três notas altas já é o destaque. |
| Teto do bloco de etiquetas | Sem etiquetas agudas, o acúmulo deixou de ser artificial. |
| Penalidade por deslocamento e por manutenção no score do cliente | Deslocamento é consequência de falha, não falha. Penalizar duas vezes o mesmo fato. O volume vira métrica de eficiência interna, não nota do cliente. |
| Resposta em dois níveis com ~141 clientes em fila única | A fila agora se divide sozinha por pilar e por dono. |

---

Implemente na ordem: Parte 10.1 (reset) → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 15.1 e 15.2 → 8 → 9 → 10.2 a 10.4 → 11 → 14 → 15.3 a 15.9 → 12 → 13 (testes). Mantenha o tema escuro atual e não altere o layout visual além do necessário.

**Observação sobre a tela de Lançamento (Parte 9):** o bloco `Fontes de dados` passa a ter **três** áreas de upload — log de eventos, ordens de serviço e deslocamentos do Sowil. A trava de conferência de cliente vale para as três, agora pelo código de monitoramento. Nenhuma delas é obrigatória: cliente sem pronto atendimento não tem a terceira, e a tela funciona igual.
