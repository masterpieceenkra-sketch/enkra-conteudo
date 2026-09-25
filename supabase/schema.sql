-- Enkra Conteúdo / Comu HUB · esquema do banco (Supabase / Postgres 15+)
-- Só estrutura: tabelas, funções, regras de acesso, bucket e agendamentos. Nenhum dado.
-- Rode uma vez num projeto Supabase novo (SQL Editor). Depois:
--   1. preencha comu_hub_settings (fim do arquivo) com os endereços dos seus deploys e o
--      telefone de quem pode criar quadro (platform_owners);
--   2. publique as edge functions de supabase/functions (ver README);
--   3. troque <PROJECT_REF> nos agendamentos do pg_cron.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- tabelas ----------

create table if not exists public.comu_hub_launches (
  id text not null primary key,
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

create table if not exists public.comu_hub_activity (
  id bigserial primary key,
  launch_id text not null references public.comu_hub_launches(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null default '',
  action text not null,
  entity_type text,
  entity_id text,
  entity_label text,
  details jsonb,
  actor_email text not null default ''
);

create table if not exists public.comu_hub_ai_calls (
  id bigserial primary key,
  launch_id text not null references public.comu_hub_launches(id) on delete cascade,
  kind text not null,
  actor text not null default '',
  input_chars integer not null default 0,
  output_items integer not null default 0,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  model text not null default '',
  error text,
  at timestamptz not null default now()
);

create table if not exists public.comu_hub_auth_users (
  phone text primary key,
  user_id uuid not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.comu_hub_costs (
  id uuid primary key default gen_random_uuid(),
  launch_id text not null,
  name text not null,
  amount_cents bigint not null check (amount_cents >= 0 and amount_cents < 100000000000),
  frequency text not null check (frequency in ('unica', 'mensal', 'trimestral', 'anual')),
  category text not null default '',
  notes text not null default '',
  paid_by text not null default '',
  spent_on date not null,
  created_at timestamptz not null default now(),
  created_by text not null default '',
  updated_at timestamptz,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'reprovado')),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  created_by_phone text
);

create table if not exists public.comu_hub_login_codes (
  id bigserial primary key,
  launch_id text not null,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.comu_hub_notifications (
  id bigserial primary key,
  launch_id text not null references public.comu_hub_launches(id) on delete cascade,
  kind text not null,
  person_id text not null,
  person_name text not null default '',
  phone text not null,
  message text not null,
  dedupe_key text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  task_id text generated always as (substring(dedupe_key, '^(?:task|taskupdate|due|duetoday):([^:]+):')) stored,
  unique (launch_id, dedupe_key)
);

create table if not exists public.comu_hub_people (
  launch_id text not null references public.comu_hub_launches(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (launch_id, email)
);

create table if not exists public.comu_hub_settings (
  key text primary key,
  value text not null default ''
);

alter table public.comu_hub_launches enable row level security;
alter table public.comu_hub_activity enable row level security;
alter table public.comu_hub_ai_calls enable row level security;
alter table public.comu_hub_auth_users enable row level security;
alter table public.comu_hub_costs enable row level security;
alter table public.comu_hub_login_codes enable row level security;
alter table public.comu_hub_notifications enable row level security;
alter table public.comu_hub_people enable row level security;
alter table public.comu_hub_settings enable row level security;

create index if not exists comu_hub_activity_launch_at_idx on public.comu_hub_activity (launch_id, at desc);
create index if not exists comu_hub_activity_entity_idx on public.comu_hub_activity (launch_id, entity_id, at desc);
create index if not exists comu_hub_ai_calls_launch_at on public.comu_hub_ai_calls (launch_id, at desc);
create index if not exists comu_hub_costs_launch_idx on public.comu_hub_costs (launch_id, spent_on desc);
create index if not exists comu_hub_login_codes_phone on public.comu_hub_login_codes (launch_id, phone, created_at desc);
create index if not exists comu_hub_notifications_status_idx on public.comu_hub_notifications (status, id);
create index if not exists comu_hub_notifications_task on public.comu_hub_notifications (launch_id, task_id) where task_id is not null;
create index if not exists comu_hub_notifications_kind_person_idx on public.comu_hub_notifications (launch_id, kind, person_id, created_at desc);

-- ---------- funções ----------
-- as funções se chamam entre si; a ordem de criação não importa com a checagem desligada
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.comu_hub_app_url(p_state jsonb)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(
    nullif(trim(p_state->>'url'), ''),
    (select value from public.comu_hub_settings where key = 'app_url'),
    '')
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_board_name(p_state jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(nullif(trim(p_state->>'name'), ''),
                  case when p_state->>'kind' = 'content' then 'Enkra Conteúdo' else 'Comu HUB' end)
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_caller(p_state jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select p from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
  where public.comu_hub_my_phone() <> '' and public.comu_hub_my_phone() = any(public.comu_hub_person_phones(p))
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_can_edit(p_launch text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.comu_hub_my_role(p_launch) in ('admin', 'member'), false)
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_card_column(p_state jsonb, p_card jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select c from jsonb_array_elements(coalesce(p_state->'content'->'columns', '[]'::jsonb)) c
  where c->>'id' = p_card->>'columnId' limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_card_message(p_state jsonb, p_kind text, p_person_id text, p_card jsonb, p_actor text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_fill_template(public.comu_hub_template(p_state, p_kind), jsonb_build_object(
    'nome', public.comu_hub_first_name(p_state, p_person_id),
    'conteudo', coalesce(nullif(p_card->>'title', ''), 'um conteúdo'),
    'formato', public.comu_hub_format_label(p_card->>'format'),
    'publicacao', case when coalesce(p_card->>'publishAt', '') <> ''
                       then public.comu_hub_fmt_date(p_card->>'publishAt')
                            || case when coalesce(p_card->>'publishTime', '') <> '' then ' às ' || (p_card->>'publishTime') else '' end
                       else '' end,
    'prazo', case when coalesce(p_card->>'due', '') <> '' then public.comu_hub_fmt_date(p_card->>'due') else '' end,
    'link', case when public.comu_hub_app_url(p_state) <> ''
                 then public.comu_hub_app_url(p_state) || '/quadro?card=' || coalesce(p_card->>'id', '') else '' end,
    'autor', coalesce(p_actor, '')
  ) || coalesce(p_extra, '{}'::jsonb))
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_card_owner_ids(p_card jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array(select jsonb_array_elements_text(
    case when jsonb_typeof(p_card->'ownerIds') = 'array' then p_card->'ownerIds' else '[]'::jsonb end)), '{}')
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_checklist_text(p_checklists jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  with rendered as (
    select cl.ord,
      coalesce(nullif(trim(cl.c->>'title'), ''), 'Checklist') || ':' || (
        select string_agg(
          E'\n' || case when coalesce((it.i->>'done')::boolean, false) then '✅ ' else '❌ ' end
            || left(trim(coalesce(it.i->>'text', '')), 200),
          '' order by it.ord)
        from jsonb_array_elements(coalesce(cl.c->'items', '[]'::jsonb)) with ordinality it(i, ord)
        where trim(coalesce(it.i->>'text', '')) <> ''
      ) as txt
    from jsonb_array_elements(case when jsonb_typeof(p_checklists) = 'array' then p_checklists else '[]'::jsonb end)
         with ordinality cl(c, ord)
  )
  select coalesce(string_agg(txt, E'\n\n' order by ord), '') from rendered where txt is not null
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_commit(p_id text, p_state jsonb, p_expected_version bigint, p_actor text, p_events jsonb DEFAULT '[]'::jsonb, p_actor_email text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.comu_hub_launches%rowtype;
  v_ev jsonb;
  v_caller jsonb;
  v_email text;
  v_app text;
  v_pid text;
  v_msg text;
  v_tid text;
  v_task jsonb;
  v_ids text[];
  v_pemail text;
  v_actor text;
  v_action text;
  v_prev public.comu_hub_activity%rowtype;
  v_details jsonb;
  v_today text;
  v_card jsonb;
  v_review text[] := '{}';
begin
  if p_id is null or length(p_id) > 64 then raise exception 'launch id inválido'; end if;
  if pg_column_size(p_state) > 4 * 1024 * 1024 then raise exception 'estado grande demais'; end if;
  if jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 200 then
    raise exception 'eventos inválidos';
  end if;

  select * into v_row from public.comu_hub_launches where id = p_id for update;
  if not found then raise exception 'lançamento não encontrado'; end if;

  -- Quem está gravando: precisa estar no cadastro do lançamento (telefone do login).
  v_caller := public.comu_hub_caller(v_row.state);
  if v_caller is null then raise exception 'sem acesso: seu número não está no cadastro deste lançamento'; end if;
  -- Cliente do hub de conteúdo só vê: aprova e comenta pela RPC de revisão.
  if coalesce((v_caller->>'client')::boolean, false) and not coalesce((v_caller->>'admin')::boolean, false) then
    raise exception 'o cliente aprova e comenta pela tela de aprovação';
  end if;
  v_actor := left(coalesce(nullif(trim(v_caller->>'name'), ''), trim(coalesce(p_actor, ''))), 80);
  v_email := lower(trim(coalesce(v_caller->>'email', '')));
  v_today := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');

  -- Usuários, avisos e textos de aviso: só admin. E nunca pode ficar sem admin.
  if (v_row.state->'people' is distinct from p_state->'people'
      or v_row.state->'notifications' is distinct from p_state->'notifications'
      or v_row.state->'messages' is distinct from p_state->'messages')
     and not coalesce((v_caller->>'admin')::boolean, false) then
    raise exception 'só um admin altera usuários e avisos';
  end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p where coalesce((p->>'admin')::boolean, false)) then
    raise exception 'precisa ficar pelo menos um admin no cadastro';
  end if;

  -- a URL do quadro é do servidor: o navegador não muda nem apaga
  if coalesce(p_state->>'url', '') is distinct from coalesce(v_row.state->>'url', '') then
    raise exception 'o endereço do quadro não pode ser alterado por aqui';
  end if;
  v_app := public.comu_hub_app_url(v_row.state);

  if v_row.version <> p_expected_version then
    return jsonb_build_object('ok', false, 'version', v_row.version, 'state', v_row.state);
  end if;
  update public.comu_hub_launches
    set state = p_state, version = version + 1, updated_at = now(), updated_by = v_actor
    where id = p_id returning * into v_row;

  for v_ev in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    v_action := left(coalesce(v_ev->>'action', 'unknown'), 64);
    v_prev := null;

    if v_action in ('task.description', 'task.link', 'brief.set', 'diary.set', 'notify.template')
       or v_action like '%.rename' or v_action like '%.update' then
      select * into v_prev from public.comu_hub_activity
        where launch_id = p_id and action = v_action
          and coalesce(entity_id, '') = coalesce(left(v_ev->>'entityId', 128), '')
          and (case when v_email <> '' then actor_email = left(v_email, 160) else actor = v_actor end)
          and at > now() - interval '10 minutes'
        order by id desc limit 1;
    end if;

    if v_prev.id is not null then
      v_details := coalesce(v_prev.details, '{}'::jsonb) || coalesce(v_ev->'details', '{}'::jsonb);
      if jsonb_typeof(v_prev.details) = 'object' and v_prev.details ? 'from' then
        v_details := v_details || jsonb_build_object('from', v_prev.details->'from');
      end if;
      update public.comu_hub_activity
        set at = now(), entity_label = left(v_ev->>'entityLabel', 200), details = v_details
        where id = v_prev.id;
    else
      insert into public.comu_hub_activity (launch_id, actor, actor_email, action, entity_type, entity_id, entity_label, details)
      values (p_id, v_actor, left(v_email, 160), v_action,
              left(v_ev->>'entityType', 32), left(v_ev->>'entityId', 128), left(v_ev->>'entityLabel', 200), v_ev->'details');
    end if;

    if v_action in ('person.add', 'person.update') and coalesce(v_ev->>'entityId', '') <> '' then
      v_pid := v_ev->>'entityId';
      select lower(coalesce(p->>'email', '')) into v_pemail
        from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p where p->>'id' = v_pid;
      v_msg := public.comu_hub_fill_template(public.comu_hub_template(p_state, 'welcome'), jsonb_build_object(
        'nome', public.comu_hub_first_name(p_state, v_pid),
        'link', v_app,
        'autor', case when v_actor <> '' and v_pid <> (v_caller->>'id') then v_actor else '' end));
      perform public.comu_hub_enqueue(p_id, p_state, v_pid, 'welcome', 'welcome:' || v_pid, v_msg);
    end if;

    if v_action = 'task.owner'
       and coalesce((p_state->'notifications'->>'taskAssigned')::boolean, true)
       and (
         coalesce((p_state->'notifications'->>'taskAssignedRequireDue')::boolean, false) = false
         or coalesce(v_ev->'details'->>'due', '') <> ''
       ) then
      v_tid := coalesce(v_ev->>'entityId', '');
      v_ids := case
        when jsonb_typeof(v_ev->'details'->'added') = 'array' then array(select value from jsonb_array_elements_text(v_ev->'details'->'added'))
        else public.comu_hub_task_owner_ids(coalesce(v_ev->'details', '{}'::jsonb)) end;
      if coalesce(array_length(v_ids, 1), 0) > 0 then
        v_task := null;
        select t into v_task
          from jsonb_array_elements(coalesce(p_state->'phases', '[]'::jsonb)) ph,
               jsonb_array_elements(coalesce(ph->'areas', '[]'::jsonb)) a,
               jsonb_array_elements(coalesce(a->'tasks', '[]'::jsonb)) t
          where t->>'id' = v_tid limit 1;
        v_task := coalesce(v_task, '{}'::jsonb) || jsonb_build_object('id', v_tid, 'label', coalesce(v_ev->>'entityLabel', v_task->>'label', 'uma tarefa'));
        foreach v_pid in array v_ids loop
          if v_pid = '' then continue; end if;
          v_msg := public.comu_hub_task_message(p_state, 'task_assigned', v_pid, v_task, v_ev->'details'->>'due', v_actor);
          perform public.comu_hub_enqueue(p_id, p_state, v_pid, 'task_assigned', 'task:' || v_tid || ':' || v_pid, v_msg);
        end loop;
      end if;
    end if;

    -- Tarefa marcada como feita: avisa os responsáveis, menos quem marcou. Uma vez por dia
    -- por pessoa, então desmarcar e marcar de novo no mesmo dia não repete a mensagem.
    if v_action = 'task.done'
       and coalesce((p_state->'notifications'->>'taskDone')::boolean, true) then
      v_tid := coalesce(v_ev->>'entityId', '');
      v_task := null;
      select t into v_task
        from jsonb_array_elements(coalesce(p_state->'phases', '[]'::jsonb)) ph,
             jsonb_array_elements(coalesce(ph->'areas', '[]'::jsonb)) a,
             jsonb_array_elements(coalesce(a->'tasks', '[]'::jsonb)) t
        where t->>'id' = v_tid limit 1;
      if v_task is not null then
        v_task := v_task || jsonb_build_object('label', coalesce(v_ev->>'entityLabel', v_task->>'label', 'uma tarefa'));
        foreach v_pid in array public.comu_hub_task_owner_ids(v_task) loop
          if v_pid = '' or v_pid = coalesce(v_caller->>'id', '') then continue; end if;
          v_msg := public.comu_hub_task_message(p_state, 'task_done', v_pid, v_task, v_task->>'due', v_actor);
          perform public.comu_hub_enqueue(p_id, p_state, v_pid, 'task_done',
            'done:' || v_tid || ':' || v_pid || ':' || v_today, v_msg);
        end loop;
      end if;
    end if;

    if v_action in ('meeting.add', 'meeting.update') and jsonb_typeof(v_ev->'details'->'attendeeIds') = 'array' then
      for v_pid in select value from jsonb_array_elements_text(v_ev->'details'->'attendeeIds') loop
        v_msg := public.comu_hub_fill_template(public.comu_hub_template(p_state, 'meeting'), jsonb_build_object(
          'nome', public.comu_hub_first_name(p_state, v_pid),
          'reuniao', coalesce(v_ev->>'entityLabel', 'Reunião'),
          'quando', public.comu_hub_fmt_date(v_ev->'details'->>'date')
            || case when coalesce(v_ev->'details'->>'time', '') <> '' then ' às ' || (v_ev->'details'->>'time') else '' end,
          'link', coalesce(v_ev->'details'->>'link', ''),
          'autor', v_actor));
        if v_action = 'meeting.update' then
          v_msg := replace(v_msg, 'Reunião marcada:', 'Reunião atualizada:');
        end if;
        perform public.comu_hub_enqueue(p_id, p_state, v_pid, 'meeting',
          'meeting:' || coalesce(v_ev->>'entityId', '') || ':' || v_pid || ':' || coalesce(v_ev->'details'->>'date', '') || coalesce(v_ev->'details'->>'time', ''),
          v_msg);
      end loop;
    end if;

    -- ---------- hub de conteúdo ----------
    if v_action like 'card.%' then
      v_card := null;
      select k into v_card from jsonb_array_elements(coalesce(p_state->'content'->'cards', '[]'::jsonb)) k
       where k->>'id' = coalesce(v_ev->>'entityId', '') limit 1;
    end if;

    -- Card atribuído: avisa quem entrou como responsável (menos quem atribuiu a si mesmo).
    if v_action = 'card.owner' and v_card is not null
       and coalesce((p_state->'notifications'->>'cardAssigned')::boolean, true)
       and jsonb_typeof(v_ev->'details'->'added') = 'array' then
      for v_pid in select value from jsonb_array_elements_text(v_ev->'details'->'added') loop
        if v_pid = '' or v_pid = coalesce(v_caller->>'id', '') then continue; end if;
        perform public.comu_hub_enqueue(p_id, p_state, v_pid, 'card_assigned',
          'card:' || (v_card->>'id') || ':' || v_pid,
          public.comu_hub_card_message(p_state, 'card_assigned', v_pid, v_card, v_actor));
      end loop;
    end if;

    -- Entrou numa coluna em que o cliente aprova: junta para um aviso só no fim do commit.
    if v_action = 'card.move' and v_card is not null
       and coalesce((v_ev->'details'->>'toApproval')::boolean, false) then
      v_review := array_append(v_review, v_card->>'id');
    end if;

    -- Comentário do time: avisa os responsáveis, menos quem comentou.
    if v_action = 'card.comment' and v_card is not null
       and coalesce((p_state->'notifications'->>'contentComment')::boolean, true) then
      foreach v_pid in array public.comu_hub_card_owner_ids(v_card) loop
        if v_pid = '' or v_pid = coalesce(v_caller->>'id', '') then continue; end if;
        perform public.comu_hub_enqueue(p_id, p_state, v_pid, 'content_comment',
          'comment:' || coalesce(v_ev->'details'->>'commentId', v_today) || ':' || v_pid,
          public.comu_hub_card_message(p_state, 'content_comment', v_pid, v_card, v_actor,
            jsonb_build_object('comentario', coalesce(v_ev->'details'->>'text', ''))));
      end loop;
    end if;
  end loop;

  if coalesce(array_length(v_review, 1), 0) > 0
     and coalesce((p_state->'notifications'->>'contentReview')::boolean, true) then
    perform public.comu_hub_enqueue_review(p_id, p_state, v_review, v_actor, 'review:' || v_row.version);
  end if;

  if v_email <> '' then
    insert into public.comu_hub_people (launch_id, email, name, phone)
    values (p_id, v_email, v_actor, coalesce(v_caller->>'phone', ''))
    on conflict (launch_id, email) do update set name = excluded.name, phone = excluded.phone, last_seen = now();
  end if;
  return jsonb_build_object('ok', true, 'version', v_row.version);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_content_notify_review(p_launch_id text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.comu_hub_launches%rowtype; v_caller jsonb;
begin
  select * into v_row from public.comu_hub_launches where id = p_launch_id;
  if not found then raise exception 'quadro não encontrado'; end if;
  if not public.comu_hub_can_edit(p_launch_id) then raise exception 'só o time avisa o cliente'; end if;
  v_caller := public.comu_hub_caller(v_row.state);
  return public.comu_hub_enqueue_review(p_launch_id, v_row.state, public.comu_hub_pending_review_ids(v_row.state),
    coalesce(v_caller->>'name', ''), 'reviewnow:' || floor(extract(epoch from now()))::bigint);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_content_overview()
 RETURNS TABLE(id text, name text, planned_week integer, published_week integer, goal_week integer, late integer, with_client integer, adjust_week integer, in_progress integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with bounds as (
    select (now() at time zone 'America/Sao_Paulo')::date as today,
           date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date as mon
  ), b as (
    select l.id, l.state, x.today, x.mon, x.mon + 6 as sun
    from public.comu_hub_launches l, bounds x
    where l.state->>'kind' = 'content'
      and public.comu_hub_role_in(l.state, public.comu_hub_my_phone()) in ('admin', 'member')
  ), k as (
    select b.id, b.today, b.mon, b.sun, c as card,
           coalesce(public.comu_hub_card_column(b.state, c)->>'stage', 'custom') as stage,
           coalesce((public.comu_hub_card_column(b.state, c)->>'clientApproves')::boolean, false) as approves,
           nullif(c->>'publishAt', '') as pub,
           nullif(c->>'publishedAt', '') as pubd
    from b, jsonb_array_elements(coalesce(b.state->'content'->'cards', '[]'::jsonb)) c
  )
  select b.id,
         coalesce(nullif(b.state->>'name', ''), b.id),
         (select count(*)::int from k where k.id = b.id and k.pub::date between b.mon and b.sun),
         (select count(*)::int from k where k.id = b.id and k.stage = 'published'
            and coalesce(k.pubd, k.pub)::date between b.mon and b.sun),
         (select coalesce(sum((g->>'perWeek')::int), 0)::int
            from jsonb_array_elements(coalesce(b.state->'content'->'strategy'->'cadence', '[]'::jsonb)) g),
         (select count(*)::int from k where k.id = b.id and k.stage <> 'published' and k.pub::date < b.today),
         (select count(*)::int from k where k.id = b.id and k.approves and k.card->'approval'->>'state' = 'pendente'),
         (select count(*)::int from k, jsonb_array_elements(coalesce(k.card->'comments', '[]'::jsonb)) m
            where k.id = b.id and m->>'kind' = 'ajuste'
              and ((m->>'at')::timestamptz at time zone 'America/Sao_Paulo')::date between b.mon and b.sun),
         (select count(*)::int from k where k.id = b.id and k.stage <> 'published')
  from b
  order by 2
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_content_review(p_launch_id text, p_card_id text, p_decision text, p_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.comu_hub_launches%rowtype;
  v_caller jsonb; v_actor text; v_text text; v_now text;
  v_card jsonb; v_idx int; v_col jsonb; v_next text; v_cards jsonb; v_comment jsonb;
  v_pid text; v_moved boolean := false;
begin
  if p_decision not in ('aprovado', 'ajuste', 'comentario') then raise exception 'decisão inválida'; end if;
  v_text := left(trim(coalesce(p_text, '')), 4000);
  if p_decision = 'ajuste' and v_text = '' then raise exception 'Escreva o que precisa mudar.'; end if;
  if p_decision = 'comentario' and v_text = '' then raise exception 'Comentário vazio.'; end if;

  select * into v_row from public.comu_hub_launches where id = p_launch_id for update;
  if not found then raise exception 'quadro não encontrado'; end if;
  if coalesce(v_row.state->>'kind', '') <> 'content' then raise exception 'este quadro não é de conteúdo'; end if;
  v_caller := public.comu_hub_caller(v_row.state);
  if v_caller is null then raise exception 'sem acesso: seu número não está no cadastro deste quadro'; end if;
  v_actor := left(coalesce(nullif(trim(v_caller->>'name'), ''), 'Cliente'), 80);

  select (t.ord - 1)::int, t.k into v_idx, v_card
    from jsonb_array_elements(coalesce(v_row.state->'content'->'cards', '[]'::jsonb)) with ordinality as t(k, ord)
   where t.k->>'id' = p_card_id;
  if v_card is null then raise exception 'card não encontrado'; end if;
  v_col := public.comu_hub_card_column(v_row.state, v_card);

  if p_decision <> 'comentario' and not (
       coalesce((v_col->>'clientApproves')::boolean, false) and v_card->'approval'->>'state' = 'pendente') then
    raise exception 'Este conteúdo não está esperando aprovação agora.';
  end if;

  v_now := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_comment := jsonb_build_object(
    'id', 'cm_' || replace(gen_random_uuid()::text, '-', ''),
    'authorId', coalesce(v_caller->>'id', ''),
    'authorName', v_actor,
    'text', case when v_text = '' then 'Aprovado.' else v_text end,
    'at', v_now,
    'kind', p_decision);
  v_card := v_card || jsonb_build_object('comments',
    (select coalesce(jsonb_agg(z.c order by z.o), '[]'::jsonb) from (
       select x.c, x.o from jsonb_array_elements(coalesce(v_card->'comments', '[]'::jsonb) || jsonb_build_array(v_comment))
         with ordinality as x(c, o) order by x.o desc limit 300) z));

  if p_decision = 'aprovado' then
    v_card := v_card || jsonb_build_object('approval', jsonb_build_object('state', 'aprovado', 'byName', v_actor, 'at', v_now));
    select t.c->>'id' into v_next
      from jsonb_array_elements(coalesce(v_row.state->'content'->'columns', '[]'::jsonb)) with ordinality as t(c, ord)
     where t.ord = (select t2.ord + 1 from jsonb_array_elements(v_row.state->'content'->'columns') with ordinality as t2(c2, ord)
                     where t2.c2->>'id' = v_col->>'id');
    if v_next is not null then
      v_card := v_card || jsonb_build_object('columnId', v_next);
      v_moved := true;
    end if;
  elsif p_decision = 'ajuste' then
    v_card := v_card || jsonb_build_object('approval',
      jsonb_build_object('state', 'ajuste', 'byName', v_actor, 'at', v_now, 'note', v_text));
  end if;

  v_cards := (v_row.state->'content'->'cards') - v_idx;
  if v_moved then v_cards := v_cards || jsonb_build_array(v_card);
  else v_cards := jsonb_insert(v_cards, array[v_idx::text], v_card);
  end if;

  update public.comu_hub_launches
     set state = jsonb_set(jsonb_set(v_row.state, '{content,cards}', v_cards), '{updatedAt}', to_jsonb(v_now)),
         version = version + 1, updated_at = now(), updated_by = v_actor
   where id = p_launch_id returning * into v_row;

  insert into public.comu_hub_activity (launch_id, actor, actor_email, action, entity_type, entity_id, entity_label, details)
  values (p_launch_id, v_actor, left(lower(coalesce(v_caller->>'email', '')), 160), 'card.review', 'card', p_card_id,
          left(coalesce(nullif(v_card->>'title', ''), 'Card sem título'), 200),
          jsonb_build_object('decision', p_decision, 'text', left(v_text, 300)));

  foreach v_pid in array public.comu_hub_card_owner_ids(v_card) loop
    if v_pid = '' or v_pid = coalesce(v_caller->>'id', '') then continue; end if;
    if p_decision = 'comentario' then
      if coalesce((v_row.state->'notifications'->>'contentComment')::boolean, true) then
        perform public.comu_hub_enqueue(p_launch_id, v_row.state, v_pid, 'content_comment',
          'comment:' || (v_comment->>'id') || ':' || v_pid,
          public.comu_hub_card_message(v_row.state, 'content_comment', v_pid, v_card, v_actor,
            jsonb_build_object('comentario', v_text)));
      end if;
    elsif coalesce((v_row.state->'notifications'->>'contentDecision')::boolean, true) then
      perform public.comu_hub_enqueue(p_launch_id, v_row.state, v_pid, 'content_decision',
        'decision:' || (v_comment->>'id') || ':' || v_pid,
        public.comu_hub_card_message(v_row.state, 'content_decision', v_pid, v_card, v_actor,
          jsonb_build_object('decisao', case when p_decision = 'aprovado' then 'aprovado ✅' else 'devolvido com ajuste ✏️' end,
                             'comentario', v_text)));
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'version', v_row.version);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_cost_actor(p_launch_id text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_state jsonb; v_caller jsonb;
begin
  select state into v_state from public.comu_hub_launches where id = p_launch_id;
  if v_state is null then raise exception 'quadro não encontrado'; end if;
  v_caller := public.comu_hub_caller(v_state);
  if v_caller is null or not coalesce((v_caller->>'admin')::boolean, false) then
    raise exception 'só um admin vê e lança custos';
  end if;
  return left(coalesce(nullif(trim(v_caller->>'name'), ''), ''), 80);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_cost_approver(p_launch_id text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_state jsonb; v_caller jsonb;
begin
  select state into v_state from public.comu_hub_launches where id = p_launch_id;
  if v_state is null then raise exception 'quadro não encontrado'; end if;
  v_caller := public.comu_hub_caller(v_state);
  if v_caller is null or not coalesce((v_caller->>'finance')::boolean, false) then
    raise exception 'só quem está no financeiro aprova ou reprova custo';
  end if;
  return left(coalesce(nullif(trim(v_caller->>'name'), ''), ''), 80);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_cost_decide(p_launch_id text, p_id uuid, p_status text, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor text := public.comu_hub_cost_approver(p_launch_id);
  v_state jsonb;
  v_row public.comu_hub_costs;
  v_pid text;
  v_note text := left(trim(coalesce(p_note, '')), 500);
begin
  if p_status not in ('aprovado', 'reprovado') then raise exception 'decisão inválida'; end if;
  if p_status = 'reprovado' and v_note = '' then
    raise exception 'escreva a justificativa da reprovação';
  end if;
  select state into v_state from public.comu_hub_launches where id = p_launch_id;

  update public.comu_hub_costs
    set status = p_status, decided_by = v_actor, decided_at = now(),
        decision_note = case when p_status = 'reprovado' then v_note else nullif(v_note, '') end
  where id = p_id and launch_id = p_launch_id
  returning * into v_row;
  if v_row.id is null then raise exception 'custo não encontrado'; end if;

  -- avisa quem publicou, achando a pessoa pelo telefone de quem gravou
  if coalesce((v_state->'notifications'->>'costDecision')::boolean, true)
     and coalesce(v_row.created_by_phone, '') <> '' then
    select p->>'id' into v_pid from jsonb_array_elements(coalesce(v_state->'people', '[]'::jsonb)) p
      where v_row.created_by_phone = any(public.comu_hub_person_phones(p)) limit 1;
    if v_pid is not null then
      perform public.comu_hub_enqueue(p_launch_id, v_state, v_pid, 'cost_decision',
        'costdec:' || v_row.id::text || ':' || p_status || ':' || to_char(v_row.decided_at, 'YYYYMMDDHH24MISS'),
        public.comu_hub_cost_message(v_state, v_row, 'cost_decision', v_pid, v_actor,
          case when p_status = 'aprovado' then 'aprovado ✅' else 'reprovado ❌' end, v_note));
    end if;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_cost_message(p_state jsonb, p_cost comu_hub_costs, p_kind text, p_person_id text, p_actor text, p_decision text DEFAULT ''::text, p_note text DEFAULT ''::text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_fill_template(public.comu_hub_template(p_state, p_kind), jsonb_build_object(
    'nome', public.comu_hub_first_name(p_state, p_person_id),
    'custo', coalesce(p_cost.name, ''),
    'valor', public.comu_hub_money(p_cost.amount_cents),
    'frequencia', public.comu_hub_frequency_label(p_cost.frequency),
    'categoria', coalesce(p_cost.category, ''),
    'data', public.comu_hub_fmt_date(p_cost.spent_on::text),
    'quem_pagou', coalesce(p_cost.paid_by, ''),
    'obs', coalesce(p_cost.notes, ''),
    'decisao', coalesce(p_decision, ''),
    'justificativa', coalesce(p_note, ''),
    'link', case when public.comu_hub_app_url(p_state) <> ''
                 then public.comu_hub_app_url(p_state) || '/custos' else '' end,
    'autor', coalesce(p_actor, '')
  ))
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_cost_remove(p_launch_id text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.comu_hub_cost_actor(p_launch_id);
  delete from public.comu_hub_costs where id = p_id and launch_id = p_launch_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_cost_save(p_launch_id text, p_id uuid, p_name text, p_amount_cents bigint, p_frequency text, p_category text, p_notes text, p_paid_by text, p_spent_on date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor text := public.comu_hub_cost_actor(p_launch_id);
  v_state jsonb;
  v_row public.comu_hub_costs;
  v_old public.comu_hub_costs;
  v_p jsonb;
  v_new boolean := p_id is null;
  v_reopen boolean := false;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'o custo precisa de um nome'; end if;
  if p_amount_cents is null or p_amount_cents < 0 then raise exception 'valor inválido'; end if;
  if p_frequency not in ('unica', 'mensal', 'trimestral', 'anual') then
    raise exception 'frequência inválida';
  end if;
  if p_spent_on is null then raise exception 'informe a data do custo'; end if;
  select state into v_state from public.comu_hub_launches where id = p_launch_id;

  if v_new then
    insert into public.comu_hub_costs
      (launch_id, name, amount_cents, frequency, category, notes, paid_by, spent_on,
       created_by, created_by_phone)
    values (p_launch_id, left(trim(p_name), 120), p_amount_cents, p_frequency,
            left(trim(coalesce(p_category, '')), 40), left(coalesce(p_notes, ''), 1000),
            left(trim(coalesce(p_paid_by, '')), 80), p_spent_on, v_actor, public.comu_hub_my_phone())
    returning * into v_row;
  else
    select * into v_old from public.comu_hub_costs where id = p_id and launch_id = p_launch_id;
    if v_old.id is null then raise exception 'custo não encontrado'; end if;
    v_reopen := v_old.status <> 'pendente' and (
      v_old.name is distinct from left(trim(p_name), 120)
      or v_old.amount_cents is distinct from p_amount_cents
      or v_old.frequency is distinct from p_frequency
      or v_old.spent_on is distinct from p_spent_on);

    update public.comu_hub_costs set
      name = left(trim(p_name), 120), amount_cents = p_amount_cents, frequency = p_frequency,
      category = left(trim(coalesce(p_category, '')), 40), notes = left(coalesce(p_notes, ''), 1000),
      paid_by = left(trim(coalesce(p_paid_by, '')), 80), spent_on = p_spent_on, updated_at = now(),
      status = case when v_reopen then 'pendente' else status end,
      decided_by = case when v_reopen then null else decided_by end,
      decided_at = case when v_reopen then null else decided_at end,
      decision_note = case when v_reopen then null else decision_note end
    where id = p_id and launch_id = p_launch_id
    returning * into v_row;
  end if;

  -- avisa o financeiro quando entra uma solicitação nova (ou quando uma volta para a fila)
  if (v_new or v_reopen) and coalesce((v_state->'notifications'->>'costNew')::boolean, true) then
    for v_p in select p from jsonb_array_elements(coalesce(v_state->'people', '[]'::jsonb)) p
               where coalesce((p->>'finance')::boolean, false) loop
      perform public.comu_hub_enqueue(p_launch_id, v_state, v_p->>'id', 'cost_new',
        'cost:' || v_row.id::text || case when v_new then '' else ':' || to_char(v_row.updated_at, 'YYYYMMDDHH24MISS') end,
        public.comu_hub_cost_message(v_state, v_row, 'cost_new', v_p->>'id', v_actor));
    end loop;
  end if;
  return v_row.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_create_launch(p_id text, p_state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind text := coalesce(p_state->>'kind', '');
  v_url text;
  v_state jsonb;
  v_actor text;
  v_admin jsonb;
begin
  if not public.comu_hub_is_platform_owner() then
    raise exception 'só quem administra a plataforma cria quadro';
  end if;
  if p_id !~ '^[a-z0-9][a-z0-9-]{1,39}$' then raise exception 'endereço inválido'; end if;
  if p_id in ('novo', 'quadros', 'entrar', 'sair', 'verificador', 'assets', 'api') then
    raise exception 'esse endereço é reservado';
  end if;
  if exists (select 1 from public.comu_hub_launches where id = p_id) then
    raise exception 'já existe um quadro nesse endereço';
  end if;
  if pg_column_size(p_state) > 4 * 1024 * 1024 then raise exception 'estado grande demais'; end if;
  if v_kind not in ('launch', 'sprint', 'blank', 'content') then
    raise exception 'modelo de quadro inválido';
  end if;
  if v_kind = 'content' then
    if jsonb_typeof(p_state->'content') <> 'object' or jsonb_typeof(p_state->'content'->'columns') <> 'array'
       or jsonb_array_length(p_state->'content'->'columns') = 0 then
      raise exception 'o quadro de conteúdo precisa de colunas';
    end if;
  elsif jsonb_typeof(p_state->'phases') <> 'array' or jsonb_array_length(p_state->'phases') = 0 then
    raise exception 'o quadro precisa de pelo menos uma fase';
  end if;
  -- precisa nascer com um admin que tenha telefone, senão ninguém entra nem administra
  select p into v_admin from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
   where coalesce((p->>'admin')::boolean, false)
     and cardinality(public.comu_hub_person_phones(p)) > 0
   limit 1;
  if v_admin is null then raise exception 'o quadro precisa de um admin com WhatsApp'; end if;

  v_url := coalesce((select value from public.comu_hub_settings
                      where key = case when v_kind = 'content' then 'content_url' else 'hub_url' end), '');
  v_state := p_state
    || jsonb_build_object('url', case when v_url <> '' then v_url || '/' || p_id else '' end)
    || jsonb_build_object('notifications', coalesce(p_state->'notifications', '{}'::jsonb));

  insert into public.comu_hub_launches (id, state, version, updated_by)
  values (p_id, v_state, 1, coalesce(v_admin->>'name', ''));

  v_actor := coalesce((select p->>'name' from jsonb_array_elements(v_state->'people') p
                        where public.comu_hub_my_phone() = any(public.comu_hub_person_phones(p))
                        limit 1), '');
  insert into public.comu_hub_activity (launch_id, actor, action, entity_type, entity_id, entity_label, details)
  values (p_id, v_actor, 'launch.create', 'launch', p_id,
          coalesce(nullif(v_state->>'name', ''), p_id),
          jsonb_build_object('kind', v_state->>'kind'));

  for v_admin in select p from jsonb_array_elements(coalesce(v_state->'people', '[]'::jsonb)) p loop
    perform public.comu_hub_enqueue(p_id, v_state, v_admin->>'id', 'welcome',
      'welcome:' || (v_admin->>'id'),
      public.comu_hub_fill_template(public.comu_hub_template(v_state, 'welcome'), jsonb_build_object(
        'nome', public.comu_hub_first_name(v_state, v_admin->>'id'),
        'link', public.comu_hub_app_url(v_state),
        'autor', v_actor)));
  end loop;

  return jsonb_build_object('ok', true, 'id', p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_default_template(p_kind text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case p_kind
    when 'task_assigned' then E'Olá, {nome}! Você ficou responsável por *{tarefa}* no Comu HUB. 🔥\n\n*Prazo: {prazo}.* ⏳\n\n{checklist}\n\nAbrir card em: {link}\n\n{autor} · Comu HUB 👋'
    when 'task_update' then E'Olá, {nome}! A tarefa *{tarefa}* foi atualizada no Comu HUB. 🔥\n\n*Prazo: {prazo}.* ⏳\n\n{checklist}\n\nAbrir card em: {link}\n\n{autor} · Comu HUB 👋'
    when 'due_tomorrow' then E'Olá, {nome}! Lembrete: a tarefa *{tarefa}* vence amanhã. ⏰\n\n*Prazo: {prazo}.* ⏳\n\n{checklist}\n\nAbrir card em: {link}\n\n{autor} · Comu HUB 👋'
    when 'due_today' then E'Olá, {nome}! Lembrete: a tarefa *{tarefa}* vence hoje. ⏰\n\n*Prazo: {prazo}.* ⏳\n\n{checklist}\n\nAbrir card em: {link}\n\n{autor} · Comu HUB 👋'
    when 'overdue' then E'Olá, {nome}! A tarefa *{tarefa}* está atrasada. 🚨\n\n*Prazo: {prazo}* · {atraso} de atraso. ⏳\n\n{checklist}\n\nAbrir card em: {link}\n\nComu HUB 👋'
    when 'task_done' then E'Olá, {nome}! Sua tarefa *{tarefa}* foi concluída no Comu HUB. ✅\n\nAbrir card em: {link}\n\n{autor} · Comu HUB 👋'
    when 'cost_new' then E'Olá, {nome}! Nova solicitação de custo no Comu HUB, esperando sua aprovação. 💸\n\n*{custo}*\n*Valor: {valor}* (cobrança {frequencia})\nCategoria: {categoria}\nData: {data}\nSolicitado por: {autor}\n\n{obs}\n\nAprovar ou reprovar em: {link}\n\nComu HUB 👋'
    when 'cost_decision' then E'Olá, {nome}! O custo *{custo}* ({valor}) foi {decisao}\n\nMotivo: {justificativa}\n\nVer em: {link}\n\n{autor} · Comu HUB 👋'
    when 'meeting' then E'Olá, {nome}! Reunião marcada: *{reuniao}*. 📅\n\n*Quando: {quando}.*\n\nEntrar: {link}\n\n{autor} · Comu HUB 👋'
    when 'welcome' then E'Olá, {nome}! 👋\nVocê foi cadastrado(a) no *Comu HUB*, o painel do lançamento, por {autor}.\nPor lá ficam o checklist, as suas tarefas, as reuniões e o histórico do time. Quando uma tarefa for sua ou uma reunião for marcada com você, eu te aviso por aqui.\n\nAcesse: {link}'
    when 'card_assigned' then E'Olá, {nome}! Você ficou responsável pelo conteúdo *{conteudo}* ({formato}) no {painel}. 🎬\n\nPublicação: {publicacao}\nPrazo de produção: {prazo}\n\nAbrir card: {link}\n\n{autor} · {painel} 👋'
    when 'card_due' then E'Olá, {nome}! O prazo de produção de *{conteudo}* vence {quando}. ⏰\n\nPublicação: {publicacao}\n\nAbrir card: {link}\n\n{painel} 👋'
    when 'content_review' then E'Olá, {nome}! Tem conteúdo esperando a sua aprovação no {painel}. 👀\n\n{lista}\n\nAprovar ou pedir ajuste: {link}\n\n{autor} · {painel} 👋'
    when 'content_decision' then E'Olá, {nome}! O conteúdo *{conteudo}* foi {decisao} por {autor}.\n\nComentário: {comentario}\n\nAbrir card: {link}\n\n{painel} 👋'
    when 'content_comment' then E'Olá, {nome}! {autor} comentou em *{conteudo}*. 💬\n\n{comentario}\n\nResponder: {link}\n\n{painel} 👋'
    when 'content_publish_today' then E'Olá, {nome}! Hoje é dia de publicar *{conteudo}* ({formato}). 🚀\n\nPublicação: {publicacao}\n\nAbrir card: {link}\n\n{painel} 👋'
    when 'content:welcome' then E'Olá, {nome}! 👋\nVocê foi cadastrado(a) no *{painel}*, o hub de conteúdo, por {autor}.\nPor lá ficam o quadro, o calendário e os posts para aprovar. Quando um conteúdo for seu ou precisar da sua aprovação, eu te aviso por aqui.\n\nAcesse: {link}'
    else '' end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_enqueue(p_launch_id text, p_state jsonb, p_person_id text, p_kind text, p_dedupe text, p_message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p jsonb; v_phones text[]; v_i int;
begin
  select p into v_p from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p where p->>'id' = p_person_id;
  if v_p is null or coalesce((v_p->>'notify')::boolean, true) = false then return; end if;
  v_phones := public.comu_hub_person_phones(v_p);
  if coalesce(array_length(v_phones, 1), 0) = 0 then return; end if;
  for v_i in 1 .. array_length(v_phones, 1) loop
    insert into public.comu_hub_notifications (launch_id, kind, person_id, person_name, phone, message, dedupe_key)
    values (p_launch_id, p_kind, p_person_id, coalesce(v_p->>'name', ''), v_phones[v_i], p_message,
            case when v_i = 1 then p_dedupe else p_dedupe || '#' || v_i end)
    on conflict (launch_id, dedupe_key) do nothing;
  end loop;
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_enqueue_due_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_l record; v_t jsonb; v_pid text; v_today text; v_tomorrow text; v_n int := 0;
  v_every int; v_days int; v_hour int; v_when int; v_stage text;
begin
  v_today := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD');
  v_tomorrow := to_char((now() at time zone 'America/Sao_Paulo')::date + 1, 'YYYY-MM-DD');
  v_hour := extract(hour from (now() at time zone 'America/Sao_Paulo'))::int;
  for v_l in select id, state from public.comu_hub_launches loop
    if v_hour = 9 and coalesce((v_l.state->'notifications'->>'dueTomorrow')::boolean, true) then
      for v_t in
        select t from jsonb_array_elements(v_l.state->'phases') ph,
                      jsonb_array_elements(ph->'areas') a,
                      jsonb_array_elements(a->'tasks') t
        where t->>'due' = v_tomorrow and coalesce((t->>'done')::boolean, false) = false
      loop
        foreach v_pid in array public.comu_hub_task_owner_ids(v_t) loop
          perform public.comu_hub_enqueue(v_l.id, v_l.state, v_pid, 'due_tomorrow',
            'due:' || (v_t->>'id') || ':' || v_pid || ':' || v_tomorrow,
            public.comu_hub_task_message(v_l.state, 'due_tomorrow', v_pid, v_t, v_tomorrow, ''));
          v_n := v_n + 1;
        end loop;
      end loop;
    end if;

    if v_hour = 9 and coalesce((v_l.state->'notifications'->>'dueToday')::boolean, true) then
      for v_t in
        select t from jsonb_array_elements(v_l.state->'phases') ph,
                      jsonb_array_elements(ph->'areas') a,
                      jsonb_array_elements(a->'tasks') t
        where t->>'due' = v_today and coalesce((t->>'done')::boolean, false) = false
      loop
        foreach v_pid in array public.comu_hub_task_owner_ids(v_t) loop
          perform public.comu_hub_enqueue(v_l.id, v_l.state, v_pid, 'due_today',
            'duetoday:' || (v_t->>'id') || ':' || v_pid || ':' || v_today,
            public.comu_hub_task_message(v_l.state, 'due_today', v_pid, v_t, v_today, ''));
          v_n := v_n + 1;
        end loop;
      end loop;
    end if;

    -- Cobrança de atraso: na hora escolhida, repetindo a cada N dias contados a partir do
    -- último aviso daquela tarefa para aquela pessoa.
    v_when := case
      when jsonb_typeof(v_l.state->'notifications'->'overdueHour') = 'number'
        then greatest(0, least(23, (v_l.state->'notifications'->>'overdueHour')::int))
      else 9 end;
    if v_hour = v_when and coalesce((v_l.state->'notifications'->>'overdue')::boolean, true) then
      v_every := case
        when jsonb_typeof(v_l.state->'notifications'->'overdueEveryDays') = 'number'
          then greatest(1, least(30, (v_l.state->'notifications'->>'overdueEveryDays')::int))
        else 1 end;
      for v_t in
        select t from jsonb_array_elements(v_l.state->'phases') ph,
                      jsonb_array_elements(ph->'areas') a,
                      jsonb_array_elements(a->'tasks') t
        where t->>'due' ~ '^\d{4}-\d{2}-\d{2}$' and t->>'due' < v_today
          and coalesce((t->>'done')::boolean, false) = false
      loop
        v_days := v_today::date - (v_t->>'due')::date;
        foreach v_pid in array public.comu_hub_task_owner_ids(v_t) loop
          if exists (
            select 1 from public.comu_hub_notifications n
            where n.launch_id = v_l.id and n.kind = 'overdue' and n.person_id = v_pid
              and n.dedupe_key like 'overdue:' || (v_t->>'id') || ':' || v_pid || ':%'
              and n.created_at > now() - make_interval(days => v_every)
          ) then continue; end if;
          perform public.comu_hub_enqueue(v_l.id, v_l.state, v_pid, 'overdue',
            'overdue:' || (v_t->>'id') || ':' || v_pid || ':' || v_today,
            public.comu_hub_overdue_message(v_l.state, v_pid, v_t, v_t->>'due', v_days));
          v_n := v_n + 1;
        end loop;
      end loop;
    end if;

    -- Hub de conteúdo, às 9h: prazo de produção (véspera e dia) e o que publica hoje.
    if v_hour = 9 and v_l.state->>'kind' = 'content' then
      for v_t in select k from jsonb_array_elements(coalesce(v_l.state->'content'->'cards', '[]'::jsonb)) k loop
        v_stage := coalesce(public.comu_hub_card_column(v_l.state, v_t)->>'stage', 'custom');
        if coalesce((v_l.state->'notifications'->>'cardDue')::boolean, true)
           and v_stage in ('idea', 'approved', 'production', 'custom')
           and v_t->>'due' in (v_today, v_tomorrow) then
          foreach v_pid in array public.comu_hub_card_owner_ids(v_t) loop
            perform public.comu_hub_enqueue(v_l.id, v_l.state, v_pid, 'card_due',
              'carddue:' || (v_t->>'id') || ':' || v_pid || ':' || (v_t->>'due'),
              public.comu_hub_card_message(v_l.state, 'card_due', v_pid, v_t, '',
                jsonb_build_object('quando', case when v_t->>'due' = v_today then 'hoje' else 'amanhã' end)));
            v_n := v_n + 1;
          end loop;
        end if;
        if coalesce((v_l.state->'notifications'->>'contentPublishToday')::boolean, false)
           and v_stage <> 'published' and v_t->>'publishAt' = v_today then
          foreach v_pid in array public.comu_hub_card_owner_ids(v_t) loop
            perform public.comu_hub_enqueue(v_l.id, v_l.state, v_pid, 'content_publish_today',
              'pubtoday:' || (v_t->>'id') || ':' || v_pid || ':' || v_today,
              public.comu_hub_card_message(v_l.state, 'content_publish_today', v_pid, v_t, ''));
            v_n := v_n + 1;
          end loop;
        end if;
      end loop;
    end if;
  end loop;
  return v_n;
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_enqueue_review(p_launch_id text, p_state jsonb, p_ids text[], p_actor text, p_dedupe text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_p jsonb; v_n int := 0; v_link text; v_msg text;
begin
  if coalesce(array_length(p_ids, 1), 0) = 0 then return 0; end if;
  v_link := case when public.comu_hub_app_url(p_state) <> '' then public.comu_hub_app_url(p_state) || '/aprovar' else '' end;
  for v_p in select p from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
             where coalesce((p->>'client')::boolean, false) and coalesce((p->>'notify')::boolean, true) loop
    v_msg := public.comu_hub_fill_template(public.comu_hub_template(p_state, 'content_review'), jsonb_build_object(
      'nome', public.comu_hub_first_name(p_state, v_p->>'id'),
      'lista', public.comu_hub_review_list(p_state, p_ids),
      'link', v_link,
      'autor', coalesce(p_actor, '')));
    perform public.comu_hub_enqueue(p_launch_id, p_state, v_p->>'id', 'content_review', p_dedupe || ':' || (v_p->>'id'), v_msg);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_fill_template(p_template text, p_values jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
declare
  v_line text; v_out text; v_key text; v_val text; v_tag text;
  v_had_empty boolean; v_rest text; v_content text;
  v_lines text[] := '{}';
begin
  foreach v_line in array string_to_array(coalesce(p_template, ''), E'\n') loop
    v_out := v_line;
    v_had_empty := false;
    for v_key, v_val in select key, trim(coalesce(value, '')) from jsonb_each_text(coalesce(p_values, '{}'::jsonb)) loop
      v_tag := '{' || v_key || '}';
      if position(v_tag in v_out) = 0 then continue; end if;
      if v_val <> '' then
        v_out := replace(v_out, v_tag, v_val);
        continue;
      end if;
      v_had_empty := true;
      v_out := regexp_replace(v_out, ',?\s*\m(por|de|com)\s+\{' || v_key || '\}', '', 'g');
      v_out := regexp_replace(v_out, '\{' || v_key || '\}\s*·\s*', '', 'g');
      v_out := regexp_replace(v_out, '\s*·\s*\{' || v_key || '\}', '', 'g');
      v_out := regexp_replace(v_out, ',\s*\{' || v_key || '\}', '', 'g');
      v_out := replace(v_out, v_tag, '');
    end loop;
    if v_had_empty then
      v_rest := regexp_replace(v_out, '[*_~]', '', 'g');
      v_content := case when position(':' in v_rest) = 0 then v_rest else substr(v_rest, position(':' in v_rest) + 1) end;
      if v_content !~ '[[:alnum:]]' then continue; end if;
    end if;
    v_lines := array_append(v_lines, v_out);
  end loop;
  return trim(both E'\n ' from regexp_replace(array_to_string(v_lines, E'\n'), E'\n{3,}', E'\n\n', 'g'));
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_first_name(p_state jsonb, p_person_id text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce((select split_part(trim(p->>'name'), ' ', 1)
    from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
    where p->>'id' = p_person_id limit 1), '')
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_fmt_date(p_iso text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case when p_iso ~ '^\d{4}-\d{2}-\d{2}$' then substr(p_iso, 9, 2) || '/' || substr(p_iso, 6, 2) else coalesce(p_iso, '') end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_format_label(p_format text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case p_format
    when 'reels' then 'Reels' when 'carrossel' then 'Carrossel' when 'estatico' then 'Estático'
    when 'stories' then 'Stories' when 'video' then 'Vídeo longo' else 'Outro' end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_frequency_label(p_frequency text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_frequency
    when 'unica' then 'única'
    when 'mensal' then 'mensal'
    when 'trimestral' then 'trimestral'
    when 'anual' then 'anual'
    else coalesce(p_frequency, '') end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_greeting(p_state jsonb, p_person_id text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select 'Olá' || coalesce(
    (select ', ' || split_part(trim(p->>'name'), ' ', 1)
       from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
      where p->>'id' = p_person_id and trim(coalesce(p->>'name', '')) <> ''
      limit 1), '') || '!'
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_is_admin(p_launch text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_my_role(p_launch) = 'admin'
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_is_member(p_launch text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_my_role(p_launch) is not null
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_is_member_any()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.comu_hub_launches l where public.comu_hub_role_in(l.state, public.comu_hub_my_phone()) is not null)
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_is_platform_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select public.comu_hub_my_phone() in (
       select jsonb_array_elements_text(nullif(value, '')::jsonb)
       from public.comu_hub_settings where key = 'platform_owners'
     ) and public.comu_hub_my_phone() <> ''),
    false)
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_launch_for_phone(p_phone text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id from public.comu_hub_launches l
  where p_phone <> '' and public.comu_hub_role_in(l.state, p_phone) is not null
  order by l.id
  limit 1
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_mark_notification(p_id bigint, p_status text, p_error text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.comu_hub_notifications
    set status = p_status, error = p_error, attempts = attempts + 1, sent_at = case when p_status = 'sent' then now() else sent_at end
    where id = p_id;
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_money(p_cents bigint)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select 'R$ ' || replace(replace(replace(
           to_char(coalesce(p_cents, 0) / 100.0, 'FM999G999G999G990D00'),
         '.', '#'), ',', '.'), '#', ',')
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_my_launches()
 RETURNS TABLE(id text, name text, kind text, role text, updated_at timestamp with time zone, people integer, tasks_open integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id,
         coalesce(nullif(l.state->>'name', ''), l.id) as name,
         coalesce(l.state->>'kind', 'launch') as kind,
         public.comu_hub_role_in(l.state, public.comu_hub_my_phone()) as role,
         l.updated_at,
         jsonb_array_length(coalesce(l.state->'people', '[]'::jsonb)) as people,
         case when l.state->>'kind' = 'content' then
           (select count(*)::int
              from jsonb_array_elements(coalesce(l.state->'content'->'cards', '[]'::jsonb)) k
             where not exists (select 1 from jsonb_array_elements(coalesce(l.state->'content'->'columns', '[]'::jsonb)) c
                                where c->>'id' = k->>'columnId' and c->>'stage' = 'published'))
         else
           (select count(*)::int
              from jsonb_array_elements(coalesce(l.state->'phases', '[]'::jsonb)) ph,
                   jsonb_array_elements(coalesce(ph->'areas', '[]'::jsonb)) a,
                   jsonb_array_elements(coalesce(a->'tasks', '[]'::jsonb)) t
             where coalesce((t->>'done')::boolean, false) = false)
         end as tasks_open
  from public.comu_hub_launches l
  where public.comu_hub_role_in(l.state, public.comu_hub_my_phone()) is not null
  order by l.updated_at desc
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_my_phone()
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->'app_metadata'->>'phone', '')
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_my_role(p_launch text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_role_in(l.state, public.comu_hub_my_phone()) from public.comu_hub_launches l where l.id = p_launch
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_overdue_message(p_state jsonb, p_person_id text, p_task jsonb, p_due text, p_days integer)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_fill_template(public.comu_hub_template(p_state, 'overdue'), jsonb_build_object(
    'nome', public.comu_hub_first_name(p_state, p_person_id),
    'tarefa', coalesce(p_task->>'label', ''),
    'prazo', case when coalesce(p_due, '') <> '' then public.comu_hub_fmt_date(p_due) else '' end,
    'checklist', public.comu_hub_checklist_text(p_task->'checklists'),
    'link', case when public.comu_hub_app_url(p_state) <> ''
                 then public.comu_hub_app_url(p_state) || '/checklist?card=' || coalesce(p_task->>'id', '')
                 else '' end,
    'atraso', case when p_days = 1 then '1 dia' else p_days || ' dias' end
  ))
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_pending_review_ids(p_state jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(array(
    select k->>'id' from jsonb_array_elements(coalesce(p_state->'content'->'cards', '[]'::jsonb)) k
    where k->'approval'->>'state' = 'pendente'
      and coalesce((public.comu_hub_card_column(p_state, k)->>'clientApproves')::boolean, false)), '{}')
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_person_phones(p_person jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when jsonb_typeof(p_person->'phones') = 'array' and jsonb_array_length(p_person->'phones') > 0
      then array(
        select v from (
          select value as v, min(ord) as o
          from jsonb_array_elements_text(p_person->'phones') with ordinality t(value, ord)
          where value <> ''
          group by value
        ) x order by o)
    when coalesce(p_person->>'phone', '') <> '' then array[p_person->>'phone']
    else '{}'::text[] end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_review_list(p_state jsonb, p_ids text[])
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with l as (
    select k, row_number() over () as n
    from jsonb_array_elements(coalesce(p_state->'content'->'cards', '[]'::jsonb)) k
    where k->>'id' = any(p_ids)
  )
  select coalesce(string_agg('• ' || coalesce(nullif(k->>'title', ''), 'Sem título') || ' ('
           || public.comu_hub_format_label(k->>'format')
           || case when coalesce(k->>'publishAt', '') <> '' then ' · ' || public.comu_hub_fmt_date(k->>'publishAt') else '' end
           || ')', E'\n' order by n) filter (where n <= 15), '')
         || case when (select count(*) from l) > 15 then E'\n• e mais ' || ((select count(*) from l) - 15) || ' conteúdos' else '' end
  from l
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_role_in(p_state jsonb, p_phone text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_phone is null or p_phone = '' then null
    when exists (select 1 from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
                 where p_phone = any(public.comu_hub_person_phones(p)) and coalesce((p->>'admin')::boolean, false)) then 'admin'
    when exists (select 1 from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
                 where p_phone = any(public.comu_hub_person_phones(p)) and coalesce((p->>'client')::boolean, false)) then 'client'
    when exists (select 1 from jsonb_array_elements(coalesce(p_state->'people', '[]'::jsonb)) p
                 where p_phone = any(public.comu_hub_person_phones(p))) then 'member'
    else null end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_send_custom(p_launch_id text, p_person_ids jsonb, p_message text, p_actor text, p_actor_email text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_caller jsonb;
  v_pid text;
  v_names text[] := '{}';
  v_name text;
  v_n int := 0;
  v_batch text := gen_random_uuid()::text;
  v_msg text := trim(coalesce(p_message, ''));
  v_actor text;
begin
  if v_msg = '' then raise exception 'mensagem vazia'; end if;
  if length(v_msg) > 1500 then raise exception 'mensagem longa demais (máx. 1500 caracteres)'; end if;
  if jsonb_typeof(coalesce(p_person_ids, '[]'::jsonb)) <> 'array' or jsonb_array_length(p_person_ids) = 0 then
    raise exception 'escolha pelo menos uma pessoa';
  end if;
  if jsonb_array_length(p_person_ids) > 100 then raise exception 'muitos destinatários'; end if;
  select state into v_state from public.comu_hub_launches where id = p_launch_id;
  if v_state is null then raise exception 'lançamento não encontrado'; end if;
  v_caller := public.comu_hub_caller(v_state);
  if v_caller is null or not coalesce((v_caller->>'admin')::boolean, false) then raise exception 'só um admin envia mensagem personalizada'; end if;
  v_actor := left(coalesce(nullif(trim(v_caller->>'name'), ''), trim(coalesce(p_actor, ''))), 80);

  for v_pid in select value from jsonb_array_elements_text(p_person_ids) loop
    select p->>'name' into v_name from jsonb_array_elements(coalesce(v_state->'people', '[]'::jsonb)) p
      where p->>'id' = v_pid and cardinality(public.comu_hub_person_phones(p)) > 0;
    if v_name is null then continue; end if;
    perform public.comu_hub_enqueue(p_launch_id, v_state, v_pid, 'custom', 'custom:' || v_batch || ':' || v_pid,
      public.comu_hub_greeting(v_state, v_pid) || E'\n\n' || v_msg
      || E'\n\n' || case when v_actor <> '' then v_actor || ' · ' else '' end || 'Comu HUB 👋');
    v_names := array_append(v_names, v_name);
    v_n := v_n + 1;
  end loop;

  insert into public.comu_hub_activity (launch_id, actor, actor_email, action, entity_type, entity_id, entity_label, details)
  values (p_launch_id, v_actor, left(lower(trim(coalesce(v_caller->>'email', ''))), 160), 'notify.custom', 'notify', v_batch,
          left(array_to_string(v_names, ', '), 200), jsonb_build_object('message', left(v_msg, 200), 'count', v_n));
  return jsonb_build_object('ok', true, 'sent', v_n, 'names', to_jsonb(v_names));
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_send_task_update(p_launch_id text, p_task jsonb, p_actor text, p_actor_email text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_state jsonb;
  v_caller jsonb;
  v_tid text := left(coalesce(p_task->>'id', ''), 128);
  v_label text := left(trim(coalesce(p_task->>'label', '')), 200);
  v_ids text[] := public.comu_hub_task_owner_ids(p_task);
  v_pid text;
  v_name text;
  v_names text[] := '{}';
  v_msg text;
  v_batch text := gen_random_uuid()::text;
  v_actor text;
begin
  if v_tid = '' or v_label = '' then raise exception 'tarefa inválida'; end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'a tarefa não tem responsável do cadastro'; end if;
  if pg_column_size(p_task) > 64 * 1024 then raise exception 'card grande demais'; end if;
  select state into v_state from public.comu_hub_launches where id = p_launch_id;
  if v_state is null then raise exception 'lançamento não encontrado'; end if;
  v_caller := public.comu_hub_caller(v_state);
  if v_caller is null then raise exception 'sem acesso a este lançamento'; end if;
  v_actor := left(coalesce(nullif(trim(v_caller->>'name'), ''), trim(coalesce(p_actor, ''))), 80);

  foreach v_pid in array v_ids loop
    select p->>'name' into v_name from jsonb_array_elements(coalesce(v_state->'people', '[]'::jsonb)) p
      where p->>'id' = v_pid and cardinality(public.comu_hub_person_phones(p)) > 0 and coalesce((p->>'notify')::boolean, true);
    if v_name is null then continue; end if;
    v_msg := public.comu_hub_task_message(v_state, 'task_update', v_pid,
      p_task || jsonb_build_object('id', v_tid, 'label', v_label), p_task->>'due', v_actor);
    perform public.comu_hub_enqueue(p_launch_id, v_state, v_pid, 'task_update',
      'taskupdate:' || v_tid || ':' || v_pid || ':' || v_batch, v_msg);
    v_names := array_append(v_names, v_name);
  end loop;
  if coalesce(array_length(v_names, 1), 0) = 0 then
    raise exception 'nenhum responsável tem WhatsApp com avisos ligados';
  end if;

  insert into public.comu_hub_activity (launch_id, actor, actor_email, action, entity_type, entity_id, entity_label, details)
  values (p_launch_id, v_actor, left(lower(trim(coalesce(v_caller->>'email', ''))), 160), 'notify.task_update', 'task', v_tid, v_label,
          jsonb_build_object('to', array_to_string(v_names, ', '), 'ownerIds', to_jsonb(v_ids)));
  return jsonb_build_object('ok', true, 'names', to_jsonb(v_names), 'name', v_names[1]);
end $function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_slug_available(p_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_is_platform_owner()
     and p_id ~ '^[a-z0-9][a-z0-9-]{1,39}$'
     and not exists (select 1 from public.comu_hub_launches where id = p_id)
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_task_message(p_state jsonb, p_kind text, p_person_id text, p_task jsonb, p_due text, p_actor text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select public.comu_hub_fill_template(public.comu_hub_template(p_state, p_kind), jsonb_build_object(
    'nome', public.comu_hub_first_name(p_state, p_person_id),
    'tarefa', coalesce(p_task->>'label', ''),
    'prazo', case when coalesce(p_due, '') <> '' then public.comu_hub_fmt_date(p_due) else '' end,
    'checklist', public.comu_hub_checklist_text(p_task->'checklists'),
    'link', case when public.comu_hub_app_url(p_state) <> ''
                 then public.comu_hub_app_url(p_state) || '/checklist?card=' || coalesce(p_task->>'id', '')
                 else '' end,
    'autor', coalesce(p_actor, '')
  ))
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_task_owner_ids(p_task jsonb)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when jsonb_typeof(p_task->'ownerIds') = 'array' and jsonb_array_length(p_task->'ownerIds') > 0
      then array(select value from jsonb_array_elements_text(p_task->'ownerIds') where value <> '')
    when coalesce(p_task->>'ownerId', '') <> '' then array[p_task->>'ownerId']
    else '{}'::text[] end
$function$
;

CREATE OR REPLACE FUNCTION public.comu_hub_template(p_state jsonb, p_kind text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select replace(
    coalesce(
      nullif(trim(left(p_state->'messages'->>p_kind, 2000)), ''),
      case when p_state->>'kind' = 'content'
           then nullif(public.comu_hub_default_template('content:' || p_kind), '') end,
      public.comu_hub_default_template(p_kind)),
    '{painel}', public.comu_hub_board_name(p_state))
$function$
;

reset check_function_bodies;

-- ---------- permissões ----------
-- Nada de função chamável sem login. O app (logado) chama só as RPCs abaixo; as funções
-- internas rodam dentro delas (security definer) ou pelas edge functions (service_role).

revoke execute on all functions in schema public from public, anon;
grant execute on function public.comu_hub_commit(text, jsonb, bigint, text, jsonb, text) to authenticated;
grant execute on function public.comu_hub_create_launch(text, jsonb) to authenticated;
grant execute on function public.comu_hub_my_launches() to authenticated;
grant execute on function public.comu_hub_is_platform_owner() to authenticated;
grant execute on function public.comu_hub_slug_available(text) to authenticated;
grant execute on function public.comu_hub_is_member_any() to authenticated;
grant execute on function public.comu_hub_is_member(text) to authenticated;
grant execute on function public.comu_hub_is_admin(text) to authenticated;
grant execute on function public.comu_hub_my_role(text) to authenticated;
grant execute on function public.comu_hub_can_edit(text) to authenticated;
grant execute on function public.comu_hub_cost_save(text, uuid, text, bigint, text, text, text, text, date) to authenticated;
grant execute on function public.comu_hub_cost_decide(text, uuid, text, text) to authenticated;
grant execute on function public.comu_hub_cost_remove(text, uuid) to authenticated;
grant execute on function public.comu_hub_send_custom(text, jsonb, text, text, text) to authenticated;
grant execute on function public.comu_hub_send_task_update(text, jsonb, text, text) to authenticated;
grant execute on function public.comu_hub_content_review(text, text, text, text) to authenticated;
grant execute on function public.comu_hub_content_notify_review(text) to authenticated;
grant execute on function public.comu_hub_content_overview() to authenticated;

-- ---------- leitura por RLS (escrita só pelas funções) ----------

create policy comu_hub_launches_read on public.comu_hub_launches for select to authenticated using (public.comu_hub_is_member(id));
create policy comu_hub_activity_read on public.comu_hub_activity for select to authenticated using (public.comu_hub_is_member(launch_id));
create policy comu_hub_people_read on public.comu_hub_people for select to authenticated using (public.comu_hub_is_member(launch_id));
create policy comu_hub_notifications_read on public.comu_hub_notifications for select to authenticated using (public.comu_hub_is_member(launch_id));
create policy comu_hub_costs_read on public.comu_hub_costs for select to authenticated using (public.comu_hub_is_admin(launch_id));
create policy comu_hub_settings_read on public.comu_hub_settings for select to authenticated
  using (key in ('whatsapp_configured', 'app_url') and public.comu_hub_is_member_any());

-- ---------- anexos do hub de conteúdo ----------

insert into storage.buckets (id, name, public, file_size_limit)
values ('content-attachments', 'content-attachments', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy content_attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'content-attachments' and public.comu_hub_is_member((storage.foldername(name))[1]));
create policy content_attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'content-attachments' and public.comu_hub_can_edit((storage.foldername(name))[1]));
create policy content_attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'content-attachments' and public.comu_hub_can_edit((storage.foldername(name))[1]));

-- ---------- tempo real ----------

alter publication supabase_realtime add table public.comu_hub_launches;
alter publication supabase_realtime add table public.comu_hub_activity;

-- ---------- configurações (preencha com os seus valores) ----------

insert into public.comu_hub_settings (key, value) values
  ('app_url', 'https://seu-painel.vercel.app'),          -- deploy de um cliente só (VITE_LAUNCH_ID)
  ('hub_url', 'https://seu-hub.vercel.app'),             -- deploy de vários clientes
  ('content_url', 'https://seu-conteudo.vercel.app'),    -- deploy do hub de conteúdo (VITE_APP=content)
  ('platform_owners', '["55DDDNUMERO"]'),                -- telefones que podem criar quadro
  ('anon_key', '<SUA_CHAVE_ANON_OU_PUBLISHABLE>'),       -- usada pelo cron para chamar a edge function
  ('whatsapp_configured', 'false')
on conflict (key) do nothing;

-- ---------- agendamentos ----------

-- envia a fila de avisos no WhatsApp a cada minuto (só quando há fila)
select cron.schedule('comu-hub-notify', '* * * * *', $cron$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/comu-hub-notify',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from public.comu_hub_settings where key = 'anon_key')),
    body := '{}'::jsonb)
  where exists (select 1 from public.comu_hub_notifications where status = 'queued');
$cron$);

-- lembretes de prazo, atraso e publica hoje (a função decide a hora, em Brasília)
select cron.schedule('comu-hub-due-reminders', '0 * * * *', $cron$ select public.comu_hub_enqueue_due_reminders(); $cron$);
