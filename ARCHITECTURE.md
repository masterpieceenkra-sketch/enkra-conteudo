# Arquitetura — GPS do Lançamento

## O que é

Ferramenta para gerir um lançamento: brief, calendário, checklist de 316 tarefas (editável) e diário de bordo. O estado é um único documento JSON. Com o Supabase configurado (`VITE_SUPABASE_*`), ele é **compartilhado pelo time em tempo real** e cada ação vai para um histórico com quem fez e quando. Sem essas variáveis, o app roda só no navegador (`localStorage`), com exportação e importação de backup.

## Stack e por quê

| Camada      | Escolha                                      | Por quê                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build       | **Vite 8**                                   | App estático, sem SSR. Build em segundos, HMR instantâneo, saída pronta para qualquer CDN.                                                                                                                                                                                                                                                                                                            |
| UI          | **React 19 + TypeScript strict**             | Componentização das 5 telas com tipos fortes no modelo de dados. `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters` ligados.                                                                                                                                                                                                                                                              |
| Estilo      | **Tailwind v4**                              | Tokens como CSS variables (`@theme`), tema claro/escuro sem runtime JS, identidade visual da Comu (Branding Strategy): paleta preto / off-white #FBF2EB / pink #F10064 / azul #3A39FF / verde-água #00C8C7 / lima #CFE600. Fontes da marca (Neue Helvena, Creato Display) não estão disponíveis para web, substituídas por Inter Tight (títulos, bold caixa alta, tracking negativo) e Inter (corpo). |
| Rotas       | **react-router v8 (modo declarativo)**       | 5 rotas simples, sem loaders/actions. TanStack Router traria type-safety de params que não usamos.                                                                                                                                                                                                                                                                                                    |
| Estado      | **Store própria com `useSyncExternalStore`** | Um único objeto `LaunchState` versionado, persistido em localStorage a cada commit. Zustand/Redux seriam dependência sem ganho para um objeto e ~20 ações.                                                                                                                                                                                                                                            |
| Ícones      | **lucide-react**                             | Tree-shakeable, mesma família do original.                                                                                                                                                                                                                                                                                                                                                            |
| Testes      | **Vitest + Testing Library**                 | Cobrem utilitários de data, seletores puros, migração/validação de JSON e todas as ações da store.                                                                                                                                                                                                                                                                                                    |
| Lint/format | **oxlint + Prettier**                        | oxlint vem com o template Vite, é rápido e inclui regras do React Compiler. Zero warnings.                                                                                                                                                                                                                                                                                                            |
| Produção    | **nginx-unprivileged (Alpine)**              | Multi-stage: Node só no build; runtime sem root, sem toolchain, porta 8080.                                                                                                                                                                                                                                                                                                                           |

Configuração por ambiente em `.env.local` (local) e nas variáveis do projeto Vercel (produção): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_LAUNCH_ID` (só no Comu HUB) e `VITE_APP=content` (só no app de conteúdo). Ver `.env.example`. A chave publishable é pública por desenho; nenhuma chave secreta entra no app.

## Estrutura

```
src/
  data/          modelo estático (semente) e tipos
    checklist.ts   modelo de lançamento: 7 fases × áreas × 237 tarefas
    brief.ts       10 blocos do brief organizados por área (uma pergunta por campo)
    ../lib/phone.ts  números dos admins → página pública /verificador (link verificador oficial anti-golpe)
    phases.ts      offsets padrão de fases e marcos a partir da data de início
    types.ts       Task, Area, Phase, Milestone, LaunchState (v2)
  store/
    launchStore.ts estado, persistência, migração v1→v2, validação de import, ações, seletores puros
  lib/
    dates.ts       ISO yyyy-mm-dd sem fuso; formatBr, addDays, diffDays, relativeLabel
  components/    Layout, PageHeader, ProgressBar, ConfirmDialog, Toast, DataMenu, ThemeToggle, AutoTextarea
  pages/         DashboardPage, BriefPage, CalendarPage, ChecklistPage, DiaryPage, NotFoundPage
public/          logos, theme.js (aplica tema antes do paint)
```

## Modelo de dados (v2)

```ts
LaunchState {
  version: 2
  launchStart: '2026-09-18'          // base do calendário
  brief: Record<fieldId, string>
  phases: Phase[]                    // cada fase carrega suas áreas e tarefas
  milestones: Milestone[]
  meetings: { id, title, date, time, durationMin, link, agenda }[]
  diary: Record<`${phaseId}:${AREA}`, string>
  updatedAt: ISO
}
Task {
  id, label, done, owner, due, custom?,
  labelIds?: string[]            // referências a state.labels
  link?: string                  // só http(s)
  description?: string
  checklists?: { id, title, items: { id, text, done }[] }[]
}
Label { id, name, color: pink | blue | aqua | lime | black | gray }
```

### Cards (estilo Trello)

Cada tarefa abre um card (`TaskDetailDialog`, um único `<dialog>` por página) com título, responsável, prazo, etiquetas, link, descrição e quantas checklists quiser, cada uma com itens e barra de progresso. As etiquetas vivem no nível do lançamento (`state.labels`, 5 padrão, editáveis) e os cards referenciam por id; excluir uma etiqueta a remove de todos os cards. Na linha da tarefa aparecem só os indicadores compactos (chips, ícones de descrição e link, `feitos/total` da checklist). O filtro por etiqueta fica na barra do checklist e a busca também procura na descrição.

Diferença chave em relação ao original: no v1 o checklist era estático e só o **status** das tarefas era salvo. No v2 a **estrutura** (fases → áreas → tarefas) faz parte do estado, o que permite renomear, excluir, reordenar e criar tarefas e áreas. Tarefas criadas pelo usuário recebem `custom: true` (aparecem com a etiqueta "própria").

### Migração e importação

`parseState(raw)` aceita qualquer JSON e devolve um estado válido ou lança erro:

- v2: valida campo a campo, descarta tarefas malformadas, normaliza datas inválidas.
- v1 (formato do app original, chave `gc-hub-lancamento-v1`): `migrateLegacy` aplica o status antigo sobre a semente e converte as chaves do diário.
- Qualquer outra coisa: erro claro no toast, nada é sobrescrito.

Na primeira carga, se existir a chave v1 no mesmo origin, ela é migrada automaticamente (sem ser apagada).

Fases adicionadas ao modelo depois entram no estado já salvo na posição do modelo, sem alterar as fases que o usuário já tinha (`mergeTemplatePhases`).

### Linha do tempo, calendário e reuniões

`Timeline` (painel e página Calendário) desenha as fases como segmentos coloridos (`data/phaseColors.ts`, tons da paleta Comu), a fase atual com contorno, um marcador "você está aqui" e os marcos como losangos; marcos a menos de 5% da barra são agrupados num bloco só para os rótulos não se sobreporem. "Ver calendário" expande uma área com dois modos: `GanttChart` (padrão: uma linha por fase com barra colorida, régua de meses e semanas, fins de semana sombreados, linhas de marcos e reuniões, linha de hoje, rolagem horizontal já posicionada na semana atual) e `MonthCalendar`: um grid mensal com cada dia pintado pela fase, marcos (lima) e reuniões (verde-água), do primeiro ao último dia do lançamento.

`MeetingsPanel` (painel) guarda reuniões em `state.meetings` com título, data, hora, duração, link http(s) e pauta. Lista as próximas em ordem, com "Entrar" e "Google Agenda".

### Google Agenda

Sem backend não há OAuth, então a integração é o link **Adicionar ao Google Agenda** (`calendar.google.com/calendar/render?action=TEMPLATE` pré-preenchido) em cada reunião (painel) e marco (página Calendário). `lib/gcal.ts` também sabe gerar um iCalendar (`buildIcs`, RFC 5545, testado) com fases, marcos e reuniões; o botão de exportar .ics foi removido da interface a pedido, mas a função fica disponível para uso futuro.

Sincronização de verdade (ler/gravar na agenda do usuário) exigiria um Client ID OAuth do Google Cloud e, para manter o app estático, o Google Identity Services no navegador.

### Sincronização compartilhada (`store/sync.ts`)

Documento inteiro com **controle de versão otimista**:

1. Ao abrir, o app busca `comu_hub_launches` (id `VITE_LAUNCH_ID`). Se não existe, cria a partir do estado local.
2. Cada ação vira um redutor + evento, entra na fila e é enviada com debounce de 400 ms pela RPC `comu_hub_commit(id, state, expected_version, actor, events)`. A RPC é atômica: só grava se a versão bate, incrementa a versão e insere os eventos.
3. Se outra pessoa gravou antes (versão diferente), a RPC devolve o estado atual; o cliente **reaplica os redutores pendentes** sobre ele e tenta de novo (até 5 vezes). Ninguém perde o que fez: dois editando campos diferentes ao mesmo tempo terminam com os dois campos.
4. Realtime (`postgres_changes` na linha do lançamento) avisa os outros clientes, que buscam o estado novo e reaplicam o que ainda estava pendente localmente.
5. Ao fechar a aba ou trocar de app, `pagehide`/`visibilitychange` forçam o envio com `fetch keepalive`.
6. Sem rede: status "Offline", a fila fica em memória e reenvia com backoff (2 s → 30 s). O localStorage continua sendo escrito, então o que foi feito offline sobrevive a um reload; o que não subiu antes de fechar a aba com a rede caída se perde no servidor.

Identidade: o perfil (`lib/actor.ts`, cache em `localStorage` `gps-actor`) é derivado do cadastro da pessoa logada (telefone do token) e o servidor ignora o `actor` do cliente, gravando o nome do cadastro; a tabela `comu_hub_people` registra visitas (`first_seen`/`last_seen`) a cada commit. Eventos de digitação contínua colapsam num só enquanto estão na fila; no servidor, a RPC de commit atualiza o registro anterior (em vez de inserir outro) quando a mesma pessoa repete uma ação de digitação (`task.description`, `task.link`, `brief.set`, `diary.set`, `*.rename`, `*.update`) na mesma entidade dentro de 10 min, mesclando `details` e preservando o `from` original. O cliente recebe INSERT e UPDATE por realtime e substitui a linha.

**Segurança do modelo por link**: RLS ligado; `anon` só lê as duas tabelas e só escreve pela RPC (`security definer`, valida tamanhos, sem delete). Quem tem o link e a chave publishable (que está no bundle, como em qualquer app Supabase) pode ler e gravar o lançamento. Para restringir a pessoas específicas, o próximo passo é Supabase Auth (link mágico por e-mail) e trocar as policies para `authenticated`.

### Histórico

`/historico` (menu ⋮) lista `comu_hub_activity` mais recente primeiro, com filtro por pessoa, busca e "carregar mais"; inserts chegam por realtime. Dentro de um card, `TaskActivity` mostra as últimas 5 ações daquela tarefa. Rótulos humanos em `store/activity.ts` (`ACTION_LABELS`, `detailText`).

### Usuários e avisos no WhatsApp

`state.people` (menu ⋮ → Usuários, só admin) é o time cadastrado: nome, e-mail, WhatsApp (obrigatório, normalizado para dígitos com DDI; é a chave de login), `notify` e `admin`. Não há mais cadastro automático pelo link: quem não está na lista não entra. Com pessoas cadastradas, o campo Responsável vira um select e a tarefa guarda `ownerId`; renomear a pessoa atualiza o nome nas tarefas, remover limpa `ownerId` e `attendeeIds`. Reuniões têm `attendeeIds` (chips "Avisar no WhatsApp").

Preferências (`state.notifications`, compartilhadas, com histórico `notify.on`/`notify.off`/`notify.every`): `taskAssigned`, `dueTomorrow`, `dueToday`, `overdue` e `taskDone`, padrão ligados, mais `taskAssignedRequireDue` (padrão desligado: quando ligado, tarefa atribuída só avisa se o card já tiver prazo) e `overdueEveryDays` (1, 2, 3 ou 7; padrão 1) e `overdueHour` (hora cheia no horário de Brasília, `America/Sao_Paulo`; padrão 9, histórico `notify.time`); a RPC de commit e o job de lembretes leem o JSON do lançamento antes de enfileirar. Boas-vindas é sempre automático. A linha "Avisos no WhatsApp" em Usuários abre o painel com esses interruptores, o envio de mensagem personalizada (RPC `comu_hub_send_custom`: escolhe pessoas do cadastro com telefone e avisos ligados, enfileira `kind='custom'` com o nome do autor no rodapé e registra `notify.custom` no histórico) e os últimos avisos com status. `comu_hub_enqueue`, `comu_hub_mark_notification` e `comu_hub_enqueue_due_reminders` não são mais executáveis pelo anon.

Fila de avisos no servidor (`comu_hub_notifications`, idempotente por `dedupe_key`):

- **welcome**: a RPC de commit enfileira em `person.add` (ou `person.update`, quando o WhatsApp é preenchido depois) uma mensagem de boas-vindas com o link do painel e quem cadastrou; `dedupe_key = welcome:<personId>`, então cada pessoa recebe uma vez.
- **task_assigned**: a RPC de commit enfileira quando chega um evento `task.owner` com `ownerId`.
- **task_update**: botão "Atualizar aviso" no card (RPC `comu_hub_send_task_update`, recebe o card do cliente e valida o destinatário no cadastro do servidor); sem deduplicação, cada clique reenvia e registra `notify.task_update` no histórico do card.
- **Resumo da reunião e "Identificar tarefas"**: `Meeting.summary` (colado à mão depois da reunião, ex.: ata do Tactiq; até 40 mil caracteres) abre em "Ver resumo da reunião" ao lado de "Google Agenda". Salvar o resumo não dispara aviso. No fim do resumo, "Identificar tarefas" lê sem IA o bloco "Itens de Ação & Próximos Passos" (`src/store/actionItems.ts`: linha "Nome:" abre um responsável, cada "–" é um item, "dd/mm" no item vira prazo, título cortado no primeiro " (" ou ": "). "Com IA" chama a edge function `comu-hub-extract-tasks` (OpenRouter com `OPENROUTER_API_KEY`, ou Anthropic com `ANTHROPIC_API_KEY`; modelo em `COMU_HUB_AI_MODEL`, limite diário em `COMU_HUB_AI_DAILY_LIMIT`, chamadas registradas em `comu_hub_ai_calls`). A IA devolve propostas por tool-use; `src/store/taskProposals.ts` resolve contra fases, áreas e pessoas (nome inteiro ou primeiro nome sem ambiguidade); o painel deixa ajustar fase, área, responsável e prazo e cria o card só no "Aceitar" (descrição, prazo, dono e checklist "Passos"). Área inexistente vira "Criar área X" e é criada uma vez por fase.
- **Vários responsáveis**: `Task.ownerIds` é a lista (pessoas do cadastro); `ownerId` é o primeiro e `owner` o texto com os nomes, mantidos coerentes por `withOwners`/`setTaskOwners` (estado antigo só com `ownerId` vira lista no parse). O campo de responsável mostra chips com × e um "+" para somar. Cada pessoa conta a tarefa no Analytics e no filtro `?resp=`. No banco, `comu_hub_task_owner_ids()` lê a lista com fallback; o aviso de tarefa atribuída sai só para quem entrou (`details.added`), lembretes de prazo e "Atualizar aviso" vão para todos (chave por tarefa:pessoa).
- **Ícone do WhatsApp no card** (ao lado das etiquetas): verde quando todos os responsáveis com telefone já receberam aviso daquela tarefa (`task_assigned` ou `task_update` com status `sent`), cinza quando falta alguém (com "1/2" se parcial). Vem de `comu_hub_notifications.task_id` (coluna gerada a partir da chave de deduplicação), lida ao vivo por `useTaskNotifications`.
- **Vários números por pessoa**: `Person.phones` é a lista (até 4) e `Person.phone` é sempre o primeiro, mantidos coerentes por `withPhones` no cadastro e no parse (cadastro antigo com só `phone` vira lista de um). Todos os números entram no login (o código chega no que a pessoa digitar) e recebem os avisos: `comu_hub_person_phones()` é a leitura no banco, `comu_hub_role_in`/`comu_hub_caller` casam com qualquer um deles e `comu_hub_enqueue` enfileira um item por número (o primeiro mantém a chave de deduplicação antiga, os outros ganham sufixo `#2`, `#3`). As edge functions `comu-hub-login` e `comu-hub-extract-tasks` usam a mesma regra.
- **Modelo do quadro e fases editáveis**: `LaunchState.kind` (`launch` | `sprint` | `blank`; ausente = lançamento) escolhe o que nasce dentro do quadro (`src/data/boardTemplates.ts`: `templatePhases`, `templateMilestones`) e o que a interface mostra. Fase pode ficar **sem data** (`start`/`end` vazios; `phaseHasDates` em `data/types.ts`): some da linha do tempo, do Gantt e do mês, e a linha do tempo diz quantas são. `addPhase`, `removePhase` (leva junto áreas, tarefas e o diário daquela fase; nunca deixa o quadro sem fase) e `movePhase` ficam em Datas, com histórico `phase.add`/`phase.remove`/`phase.move`. A primeira dessas ações liga `phasesCustom` e o modelo para de reinserir fase que falta (`mergeTemplatePhases` só roda em quadro de lançamento que ainda não foi mexido). "Início do lançamento", marcos e "Restaurar padrão" só aparecem em quadro de lançamento. O modelo de lançamento tem as fases 1 a 7: o backlog da Comu (antiga Fase 0) vive só no estado gravado dela.
- **Um app, vários quadros (hub)**: `src/lib/board.ts` resolve no carregamento de qual quadro é a página. Com `VITE_LAUNCH_ID` definido o app roda em modo `single` (um deploy por cliente, sem prefixo); sem a variável roda em modo `hub` (`seu-hub.vercel.app/<slug>`), onde o quadro é o primeiro pedaço do caminho e a raiz é a lista "Meus quadros". O prefixo entra como `basename` do router, então todos os links internos e a rota pública `/verificador` seguem valendo sem reescrita; trocar de quadro é navegação de página inteira, o que zera estado, sincronização e canais de tempo real. Chaves de armazenamento local (`gps-lancamento-v2`, `gps-actor`, `gps-collapsed-areas`) ganham sufixo por quadro no hub, e sair apaga as de todos os quadros. `SyncEngine` não cria mais quadro inexistente a partir do cache: devolve `lastErrorCode` (`not-found` | `no-access`) e o app mostra a tela de quadro indisponível em vez de encerrar a sessão — quem não está em quadro nenhum (`comu_hub_is_member_any`) é que é desconectado.
- **Criar quadro**: só quem está em `comu_hub_settings.platform_owners` (RPC `comu_hub_is_platform_owner`). A tela `/novo` monta o estado pelo modelo escolhido e chama `comu_hub_create_launch(p_id, p_state)`, que valida endereço (slug e reservados), modelo, fases e a presença de um admin com WhatsApp, grava `launch.create` no histórico e enfileira as boas-vindas. `comu_hub_my_launches()` alimenta a lista de quadros (só id, nome, papel, contagens). O endereço do quadro fica em `state.url`, gravado pelo servidor e recusado pelo commit se o navegador tentar mudar; `comu_hub_app_url(state)` decide o link das mensagens (o quadro da Comu, sem `url`, continua usando `settings.app_url`). O login aceita pedido sem quadro (raiz do hub): `comu_hub_launch_for_phone` descobre em qual quadro o telefone está.
- **Acesso e papéis**: o painel exige login por código no WhatsApp (edge function `comu-hub-login`: `request` gera um código de 6 dígitos, guarda o hash em `comu_hub_login_codes` e envia pela Evolution; `verify` confere, garante o usuário no Supabase Auth com e-mail interno `wa-<fone>@login.example.com` (domínio em `LOGIN_EMAIL_DOMAIN`) e `app_metadata.phone`, e devolve um `token_hash` de magic link que o app troca por sessão com `verifyOtp`). Só recebe código quem tem o telefone em `state.people`; a resposta é a mesma para número fora do cadastro. Limites: 1 pedido a cada 45 s, 5 por hora, 5 tentativas por código, validade 10 min. Sessão persistida no navegador; "Sair" apaga o cache local e recarrega. A rota `/verificador` continua pública.
- **RLS por telefone**: `comu_hub_my_phone()` lê `app_metadata.phone` do JWT; `comu_hub_role_in(state, phone)` devolve `admin`/`member`/null; políticas de leitura (`launches`, `activity`, `notifications`, `people`, `settings`) exigem membro e o anon não lê nada. As RPCs (`comu_hub_commit`, `comu_hub_send_custom`, `comu_hub_send_task_update`) só aceitam `authenticated`; `comu_hub_commit` exige membro, deriva o nome do histórico do cadastro (não do cliente), e só aceita mudança em `people`, `notifications` e `messages` vindo de admin, nunca deixando o cadastro sem admin. `Person.admin` é o papel: admin vê Usuários e avisos (menu ⋮), promove/despromove, cadastra e remove; "Importar backup" e "Zerar tudo" também são só admin. A edge function `comu-hub-extract-tasks` valida a sessão (bearer) e a presença no cadastro.
- **Texto dos avisos é editável no painel** (Usuários › Configurar avisos › Texto dos avisos): um modelo por tipo em `state.messages[kind]` (só os que diferem do padrão; histórico `notify.template`). Padrões em `src/data/messageTemplates.ts` e, espelhados, em `comu_hub_default_template()`. Placeholders `{nome}`, `{tarefa}`, `{prazo}`, `{checklist}`, `{link}`, `{autor}` (reunião: `{reuniao}`, `{quando}`; tarefa atrasada: `{atraso}`). O preenchimento (`fillTemplate` no front para a prévia, `comu_hub_fill_template` no banco para o envio) segue a mesma regra: placeholder vazio some junto com o conector colado nele (", por {autor}", "{autor} · "), e a linha inteira some se depois do rótulo ("Prazo:") não sobrou letra nem número. A checklist entra como bloco pronto (`comu_hub_checklist_text`: `Título:` e ❌/✅ por item, sem marcação para o WhatsApp não riscar o título).
- **meeting**: idem para `meeting.add` / `meeting.update` com `attendeeIds` (uma mensagem por participante; mudar data/hora gera outra).
- **due_tomorrow** e **due_today**: `comu_hub_enqueue_due_reminders()` roda no pg_cron de hora em hora e dispara às 09:00 de Brasília e varre o JSON do lançamento (véspera e dia do prazo, cada um com a própria preferência e chave de deduplicação).
- **overdue**: no mesmo job, que agora roda de hora em hora (`0 * * * *`; véspera e dia do prazo continuam presos às 9h), na hora de `overdueHour`, para tarefa não feita com prazo vencido, um aviso por responsável. Repete conforme `overdueEveryDays`: só enfileira se não houver `kind='overdue'` daquela tarefa para aquela pessoa (chave `overdue:<tarefa>:<pessoa>:<dia>`) nos últimos N dias, ou seja, o intervalo conta do último aviso e não do prazo. O texto tem o placeholder extra `{atraso}` ("3 dias"), montado por `comu_hub_overdue_message()`.
- **task_done**: evento `task.done` no commit. Vai para os responsáveis do card, menos quem marcou (comparação com o id de quem está logado), com chave `done:<tarefa>:<pessoa>:<dia>` — desmarcar e marcar de novo no mesmo dia não repete; em outro dia, avisa de novo.
- **custom**: mensagem escrita no painel de avisos, para as pessoas escolhidas.

Envio: a edge function `comu-hub-notify` (chamada pelo pg_cron a cada minuto via pg_net, só quando há fila — `whatsapp_configured` NÃO entra na condição do cron: é só um flag informativo que a própria função escreve a cada execução; deixá-lo no WHERE travaria o início, já que antes da primeira execução com os segredos presentes ele nunca vira 'true' sozinho) lê até 20 itens, faz `POST {EVOLUTION_URL}/send/text` (Evolution GO) com header `apikey` = token da instância e corpo `{number, text}`, marca `sent` ou reenfileira (até 3 tentativas). Os segredos `EVOLUTION_URL` (base da API, sem `/mcp`) e `EVOLUTION_APIKEY` ficam nos Secrets das Edge Functions; para a Evolution API v2 (Node) use `EVOLUTION_SEND_PATH=/message/sendText/{instance}` e `EVOLUTION_INSTANCE`; enquanto não existem, a função grava `whatsapp_configured=false` e a página Usuários mostra "ainda não configurados" com o tamanho da fila. Só quem tem `phone` e `notify` recebe.

- **Checklist abre no que falta**: o filtro padrão é `pendentes` (URL sem `?filtro`), e os chips são Pendentes · Atrasadas · Concluídas · Todas. Marcar uma tarefa nessa visão tira ela da lista na hora e mostra o aviso "Feito: …" com **Desfazer** (`useToast(mensagem, tom, { label, onClick })`, `components/Toast.tsx`). Em "Todas" as concluídas vão para o fim de cada área, esmaecidas, sem mexer na ordem gravada. Arrastar para reordenar vale só onde a ordem da tela é a ordem gravada (visão Pendentes, sem busca ou recorte); `placeTask` posiciona por id da tarefa de destino, então esconder concluídas não bagunça nada. Área com tudo feito continua à vista com "Tudo feito por aqui.". Quando o estado vem na URL (os números da Analytics mandam `?filtro=atrasadas`, `avencer`, `concluidas`, `pendentes`) ou quando se troca de chip, as fases que têm tarefa naquele recorte já abrem (`phasesWith` em `ChecklistPage.tsx`); "Todas" não abre nada a mais. Com recorte ativo (busca, área, etiqueta, responsável ou estado que não seja o do dia a dia), fase sem nada a mostrar sai da lista, e sem resultado nenhum aparece uma linha só dizendo isso.

### Custos (só admin)

`/custos` (menu ⋮ → Custos, só para admin) lança e lê o que o quadro custa: nome, valor, frequência (única, mensal, trimestral, anual), categoria, data do gasto, quem pagou e observações, com a data de publicação e o nome de quem publicou vindos do servidor.

Os custos **não ficam no documento do lançamento**, e isso é de propósito: o `state` é lido por qualquer membro. Eles vivem na tabela `comu_hub_costs` (uma linha por custo, `amount_cents` em centavos), com RLS de leitura exigindo `comu_hub_is_admin(launch_id)` e gravação pelas RPCs `comu_hub_cost_save` / `comu_hub_cost_remove`, que passam por `comu_hub_cost_actor` (confere admin pelo telefone do login e devolve o nome para `created_by`). Nada de custo entra em `comu_hub_activity`, que é legível por todo membro.

A tela tem dois tempos, em duas listas: **Solicitações** (o que está na fila, com quem solicitou) e **Custos lançados** (o que foi aprovado, aí sim com quem pagou — o campo só aparece depois da aprovação). Só o aprovado entra em total, donut e mês a mês (`counted()` em `src/store/costs.ts`; `requests()` é o resto). Cada custo nasce `pendente` e alguém do financeiro **aprova** ou **reprova** (reprovar exige justificativa, cobrada no servidor por `comu_hub_cost_decide`, não só na tela). Editar quem pagou, categoria ou observação mantém o custo aprovado; mexer em nome, valor, frequência ou data devolve para a fila e avisa o financeiro de novo (regra dentro de `comu_hub_cost_save`). O papel é `Person.finance`, marcado em Usuários **só entre admins** (tirar o admin tira o financeiro junto, no `patchPerson`), e quem decide é checado por `comu_hub_cost_approver`.

Avisos: publicar dispara `cost_new` para cada pessoa do financeiro; decidir dispara `cost_decision` para quem publicou (achado pelo `created_by_phone` gravado no save). Os dois têm interruptor em Avisos (`costNew`, `costDecision`) e texto editável em "Texto dos avisos", com os padrões espelhados em `comu_hub_default_template()`. As mensagens são montadas no banco por `comu_hub_cost_message` (helpers `comu_hub_money` e `comu_hub_frequency_label`), e o link aponta para `/custos` do próprio quadro.

As contas ficam em `src/store/costs.ts`, puras e testadas (`costs.test.ts`): `amountInMonth` (única no mês dela; mensal todo mês a partir da data; trimestral a cada 3; anual no mesmo mês de cada ano), `monthlySeries` (do primeiro mês com custo até hoje, no máximo 12 meses), `byCategory` (peso mensal de cada custo, "Sem categoria" para os sem rótulo) e `recurringPerMonth` (média do que se repete). A tela reaproveita `charts/Donut`, `charts/StatCard` e o novo `charts/Bars` (barras horizontais proporcionais).

### Hub de conteúdo (app próprio)

O mesmo código gera um terceiro produto: o hub de conteúdo de social media, publicado num projeto Vercel próprio com `VITE_APP=content`. `APP_FLAVOR` em `src/lib/board.ts` decide o sabor; as rotas por cliente (`/rhuan`), o login por WhatsApp, a sincronização, Usuários e Avisos são os mesmos do Enkra Hub. Cada app só lista e abre o seu tipo de quadro (`kind: 'content'` num, os outros no outro); abrir o quadro no app errado mostra `WrongApp` com o link certo (`state.url`, gravado pelo servidor a partir de `content_url` ou `hub_url` em `comu_hub_settings`).

**Dados.** Tudo mora em `LaunchState.content` (`src/content/model.ts`, puro e testado): `columns` (nome, cor, `stage` do fluxo e `clientApproves`), `campaigns` (período e objetivo), `cards` e `strategy`. A ordem dos cards numa coluna é a ordem do array. O card tem título, formato, redes, pilar, série, data e hora de publicação, prazo de produção, responsáveis, etiquetas (as mesmas `labels` do quadro), briefing/roteiro, legenda, anexos, links, checklist, comentários, aprovação e link do post publicado. `parseContent` lê qualquer JSON e cai nas 6 colunas padrão (Ideias, Aprovado, Em produção, Em revisão, Programado, Publicado). As ações ficam em `useContent.ts`, passando por `mutate` (o mesmo `apply` do store), então o SyncEngine reaplica tudo por cima de mudança concorrente.

**Anexos.** Bucket privado `content-attachments` (50 MB por arquivo), caminho `<quadro>/<card>/<id>-<nome>`. Ler exige `comu_hub_is_member`; subir e apagar exige `comu_hub_can_edit` (time, não cliente). O estado guarda só o caminho; a imagem aparece por URL assinada de 1 hora com cache (`attachments.ts`). O CSP libera `img-src`/`media-src` de `*.supabase.co`.

**Telas** (`src/content/pages/`): Analytics (início do time, em `WeekPage`: posts da semana, atrasados, com o cliente, ajustes, "com você", prazos e cadência), Quadro (kanban com `@dnd-kit`: arrastar entre e dentro de colunas, toque longo no celular, teclado com espaço e setas; filtros; criação rápida; menu de coluna), Calendário (mês e semana, arrastar para outro dia, bandeja "Sem data", cor por campanha, formato ou status, meta de cadência por semana), Cronograma (Gantt de campanhas com barra arrastável e bordas de redimensionar, posts como losangos arrastáveis, prazo de produção como trilho), Feed (grade 3×4 do perfil por rede; soltar um post sobre outro troca as datas), Aprovar e Estratégia. O card abre num painel lateral pela URL (`?card=`), então o link do WhatsApp cai direto nele.

**Cliente.** `Person.client` (nunca junto com admin; chip "Cliente" em Usuários só neste app). `comu_hub_role_in` devolve `client`; o commit recusa gravação de quem é cliente. O cliente age só por `comu_hub_content_review(quadro, card, decisão, texto)`: aprovar leva o card para a coluna seguinte (no fim dela), pedir ajuste exige texto e guarda a nota na aprovação, comentar entra no card. Tudo no servidor, com versão nova, atividade `card.review` e aviso aos responsáveis. A rodada de aprovação acompanha a coluna (`withApprovalFor`): entrar numa coluna com `clientApproves` abre "aguardando cliente"; sair antes da decisão cancela.

**Avisos** (novos `MessageKind`, texto editável e interruptor em Avisos, padrões espelhados em `comu_hub_default_template()`): `card_assigned` (no commit, evento `card.owner`), `content_review` (cards que entraram numa coluna de aprovação no mesmo commit viram **uma** mensagem por cliente; o botão "Avisar o cliente agora" chama `comu_hub_content_notify_review` com a fila inteira), `content_decision` e `content_comment` (pela RPC de revisão ou evento `card.comment`), `card_due` e `content_publish_today` (cron das 9h em `comu_hub_enqueue_due_reminders`). O quadro de conteúdo tem boas-vindas próprias (`content:welcome`), e `{painel}` vira o nome do quadro em qualquer texto (`comu_hub_template`).

**Analytics** (`pages/AnalyticsPage.tsx`, contas em `analytics.ts`, testadas). Semana ou mês com setas para voltar e avançar; KPIs do período com a variação contra o anterior (publicados, atrasados, com o cliente, ajustes); **meta** com anel e barras por formato; e os gráficos de posts por período (publicado, planejado que falta sair e o traço da meta nos últimos 8 períodos), atrasos, ajustes pedidos, o que está com o cliente (por coluna, com a espera em dias) e onde está o trabalho (cards por coluna, com a parte atrasada). A meta é a cadência semanal da Estratégia, uma fonte só, que se configura também pelo botão Meta; no mês ela vale proporcional aos dias. A porcentagem conta só o que foi **publicado**: entrar na coluna Publicado grava `publishedAt` (sair apaga), e o card antigo sem esse dia conta pela data de publicação. A rodada de aprovação guarda `approval.at` para medir a espera. Gráficos desenhados à mão em `content/charts.tsx` (`ColumnChart`, `GoalRing`, `ProgressRow`) mais o `Donut` que já existia.

**Visão geral dos clientes.** Em Meus quadros do app de conteúdo, `ClientsOverview` mostra a semana de cada cliente lado a lado (meta publicada, posts, atrasados, com o cliente, ajustes), com barras na mesma escala entre eles. Os números vêm da RPC `comu_hub_content_overview()`, que só devolve quadros em que a pessoa é do time (cliente não vê outros clientes) e segue as mesmas regras do `analytics.ts`.

**Estratégia.** A linha editorial no formato do guia da social media: posicionamento, Quem é (camadas por grupo e nota de contexto), Pilares por estágio do funil (com o mix real das últimas 4 semanas, `pillarMix`), Formatos, Séries, Cadência (meta semanal por formato, que o calendário e o Analytics comparam com o planejado via `weekCadence`) e Fixados. O time edita no lugar; o cliente lê.

### Analytics

`/analytics` (item de menu ao lado do Painel) é só leitura: KPIs (total, concluídas, pendentes no prazo, **a vencer** e atrasadas), donut de distribuição, barras empilhadas por fase e por responsável (com fatia do total e cargo) e donut de carga por pessoa. Seletores puros em `store/analytics.ts` (`overallStats`, `distribution`, `byOwner`, `byPhase`, `resolveOwner`); "pendente" ali exclui as atrasadas para as três fatias fecharem 100%. "A vencer" (`isDueSoon`/`dueSoonTasks`, janela `DUE_SOON_DAYS = 2`) é um recorte das pendentes: não concluída com prazo entre hoje e hoje+2; o card leva para o checklist em `?filtro=avencer`, que é um chip próprio na barra de filtros. O responsável é resolvido por identidade: `ownerId` do cadastro, texto igual ao nome de alguém do cadastro (funde), texto solto (grupo próprio) ou "Sem responsável". Gráficos desenhados à mão em `components/charts/` (Donut em SVG, StackedBars em divs, StatCard), cores de estado em `charts/colors.ts` (lima/azul/danger). O bloco "Avisos disparados" lê `comu_hub_notifications` (`store/useNotifications.ts`, até 1000 linhas, realtime) e agrega em `notificationStats`: enviadas/na fila/com falha, por tipo e por pessoa (nome e cargo atuais do cadastro quando `person_id` ainda existe). Cada número linka o checklist; o filtro `?resp=<chave>` (`p:<personId>`, `t:<texto>`, `none`) foi adicionado ao checklist com chip removível e abre todas as fases.

### Carregamento

O Painel vai no chunk principal; Brief, Calendário, Checklist e Diário são `React.lazy` com um esqueleto (`PageSkeleton`) como fallback.

## Melhorias de UX em relação ao original

- **Painel**: linha do tempo por fase com cores, marcos datados, "você está aqui" e calendário mensal expansível; bloco de próximas reuniões com pauta e link; lista de próximas tarefas da fase atual (com checkbox), alerta de atrasadas, marcos à frente com contagem, badge "agora" na fase corrente, links diretos para a fase no checklist.
- **Checklist**: cards com etiquetas, link, descrição e checklists internas; arrastar pela alça (⋮⋮) reordena na área ou move para outra área/fase (lista aberta ou cabeçalho de área recolhida; `placeTask`), com rolagem automática perto da borda; áreas recolhem pelo cabeçalho (preferência por navegador em `localStorage`); busca por tarefa/responsável/descrição, filtros por estado (todas/pendentes/atrasadas) e por área, barra de filtros fixa, expandir/recolher tudo, edição inline do nome (clique no texto), adicionar/excluir/reordenar tarefas, criar/renomear/excluir áreas, "concluir todas" por área, autocomplete de responsável com nomes do brief, prazo vencido destacado, confirmação antes de excluir.
- **Calendário**: trocar a data de início desloca fases, marcos e prazos juntos (com prévia e confirmação), gantt com marcos e "hoje", validação de fim antes do início, adicionar/excluir marcos, restaurar padrão com confirmação.
- **Brief**: índice lateral fixo com progresso por seção, percentual geral, textareas que crescem com o conteúdo, dicas nos campos longos.
- **Diário**: destaque e atalho para a fase atual, contagem de registros, áreas criadas no checklist aparecem automaticamente.
- **Global**: indicador "Salvo", tema claro/escuro (respeita o sistema), exportar/importar backup, zerar com confirmação, navegação por teclado com foco visível, skip link, `aria-*` em barras de progresso e botões de ícone, bottom nav no celular, redução de movimento respeitada.

## Segurança

- Nenhum dado sai do navegador. Nenhuma chamada de rede além das fontes do Google.
- Import de JSON passa por validação estrutural antes de ser aplicado; erro não sobrescreve nada.
- `Dockerfile` multi-stage; runtime `nginxinc/nginx-unprivileged` (uid 101), sem Node, sem shell de build. `.dockerignore` exclui `.git`, `node_modules`, `.env*`, docs.
- nginx envia `Content-Security-Policy` (sem inline script: o tema é aplicado por `public/theme.js`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. `server_tokens off`.
- `npm audit`: 0 vulnerabilidades no init. Lockfile commitado.

## Portas

| Serviço                           | Porta             |
| --------------------------------- | ----------------- |
| `npm run dev` / `npm run preview` | 5183              |
| container nginx                   | 8080 (`/healthz`) |

## Custo

Zero em runtime: é um site estático. Hospedagem em qualquer CDN gratuita (Vercel, Netlify, Cloudflare Pages) ou no container acima.

## Limites conhecidos

- Login por código no WhatsApp com RLS por telefone (ver "Acesso e papéis"). Não há senha; a segurança do acesso é a do WhatsApp da pessoa.
- Sem histórico/undo além do backup manual e do snapshot automático em `.previous` antes de importar ou zerar.
