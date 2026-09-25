# Enkra Conteúdo

> **Primeira vez?** Siga o [tutorial em PDF](docs/Tutorial-Enkra-Conteudo.pdf): baixar o código, subir no seu Supabase e na sua Vercel e mudar o que quiser, passo a passo.

Hub de conteúdo para social media e cliente trabalharem juntos: da ideia ao post no ar.

- **Quadro** estilo kanban (Ideias → Aprovado → Em produção → Em revisão → Programado → Publicado), com arrastar e soltar, colunas editáveis e filtros.
- **Card completo**: formato, redes, data e hora de publicação, prazo de produção, campanha, pilar, série, responsáveis, etiquetas, roteiro, legenda, anexos (imagem e vídeo com prévia), links, checklist e comentários.
- **Calendário** de mês e semana (arrastar para outro dia), **Cronograma** estilo Gantt das campanhas e **Grade do feed** para ver a harmonia do perfil antes de postar.
- **Aprovação do cliente**: o cliente entra com o WhatsApp dele, aprova ou pede ajuste com comentário, e o time recebe no WhatsApp.
- **Estratégia**: a linha editorial (quem é, pilares de funil, formatos, séries, cadência, fixados) ligada aos cards.
- **Analytics**: publicados contra a meta, atrasos, ajustes, o que está com o cliente e onde o trabalho está parado; visão geral de todos os clientes.
- **Avisos no WhatsApp** configuráveis (card atribuído, prazo, conteúdo para aprovar, decisão do cliente, comentário, publica hoje).

O mesmo código também gera o hub de lançamentos (checklist, brief, calendário de fases, custos). O app escolhido depende de `VITE_APP` no build.

Identidade visual da Comu (preto, off-white, pink, azul, verde-água, lima), com tema escuro e claro.

## Stack

Vite + React 19 + TypeScript strict + Tailwind v4 no front; Supabase (Postgres, Auth, Storage, Realtime, Edge Functions, pg_cron) no back; WhatsApp pela Evolution API. Detalhes e decisões em [ARCHITECTURE.md](ARCHITECTURE.md).

## Rodar local

```bash
npm install
cp .env.example .env.local   # sem as variáveis do Supabase, roda só no navegador
npm run dev
```

```bash
npm test           # testes (vitest)
npm run lint       # oxlint
npm run typecheck  # tsc
npm run build      # gera dist/
```

## Subir o servidor (Supabase)

1. Crie um projeto no Supabase.
2. No SQL Editor, rode [`supabase/schema.sql`](supabase/schema.sql). Ele cria tabelas, funções, regras de acesso, o bucket de anexos e os agendamentos. Não traz nenhum dado.
3. Ajuste no fim do arquivo (ou depois, na tabela `comu_hub_settings`): os endereços dos seus deploys, o telefone de quem pode criar quadro (`platform_owners`), a chave anon e o `<PROJECT_REF>` dos agendamentos.
4. Publique as edge functions de [`supabase/functions`](supabase/functions):
   - `comu-hub-login` (login por código no WhatsApp; sem verificação de JWT)
   - `comu-hub-notify` (envia a fila de avisos; chamada pelo pg_cron)
   - `comu-hub-extract-tasks` (IA que lê a ata da reunião; sem verificação de JWT, confere a sessão por dentro)
5. Em Edge Functions → Secrets: `EVOLUTION_URL`, `EVOLUTION_APIKEY` (opcionais `EVOLUTION_INSTANCE`, `EVOLUTION_SEND_PATH`) e, para a IA, `OPENROUTER_API_KEY` ou `ANTHROPIC_API_KEY`.

## Deploy (Vercel)

Variáveis do projeto: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_APP=content`. O `vercel.json` já traz os cabeçalhos de segurança e o redirecionamento das rotas.

Cada cliente é um quadro com endereço próprio (`/nome-do-cliente`). Quem está em `platform_owners` cria quadros em "Meus quadros → Novo quadro".

## Docker

```bash
docker build -t enkra-conteudo --build-arg VITE_APP=content .
docker run --rm -p 8080:8080 enkra-conteudo
```

Servido por nginx sem root na porta 8080, com health check em `/healthz`.
