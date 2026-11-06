create table public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source in ('text', 'phone', 'web_call')),
  raw_text text not null check (char_length(raw_text) between 1 and 8000),
  caller_last4 text check (caller_last4 ~ '^[0-9]{4}$'),
  vapi_call_id text unique,
  caller_stated_urgency text check (
    caller_stated_urgency in ('none_stated', 'low', 'medium', 'high', 'emergency')
  ),
  caller_urgency_quote text check (char_length(caller_urgency_quote) <= 300),
  extraction_status text not null check (extraction_status in ('ok', 'fallback')),
  model text,
  prompt_version text not null,
  llm_output jsonb,
  latency_ms integer check (latency_ms >= 0),
  error text
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  position smallint not null check (position between 0 and 9),
  issue_type text not null check (
    issue_type in ('Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Gas', 'Structural', 'Pest', 'Other')
  ),
  priority text not null check (priority in ('Low', 'Medium', 'High', 'Emergency')),
  model_priority text check (model_priority in ('Low', 'Medium', 'High', 'Emergency')),
  priority_source text not null check (
    priority_source in ('model', 'fallback') or priority_source like 'rule:%'
  ),
  priority_reason text not null check (char_length(priority_reason) <= 300),
  model_rationale text check (char_length(model_rationale) <= 300),
  unit text check (char_length(unit) <= 20),
  area text check (char_length(area) <= 80),
  summary text not null check (char_length(summary) between 1 and 200),
  source_quote text check (char_length(source_quote) <= 600),
  missing_fields text[] not null default '{}'
    check (missing_fields <@ array['unit_number', 'issue_detail']::text[]),
  grounding_notes text[] not null default '{}',
  needs_followup boolean not null default false,
  status text not null default 'New' check (status in ('New', 'In Progress', 'Done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, position)
);

create index work_orders_board_idx on public.work_orders (status, priority, created_at desc);

create table public.intake_events (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index intake_events_ip_time_idx on public.intake_events (ip_hash, created_at desc);
create index intake_events_time_idx on public.intake_events (created_at);

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger work_orders_touch_updated_at
before update on public.work_orders
for each row execute function public.touch_updated_at();

create function public.create_report_with_work_orders(p_report jsonb, p_orders jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  insert into public.reports (
    source, raw_text, caller_last4, vapi_call_id, caller_stated_urgency, caller_urgency_quote,
    extraction_status, model, prompt_version, llm_output, latency_ms, error
  )
  values (
    p_report ->> 'source',
    p_report ->> 'raw_text',
    p_report ->> 'caller_last4',
    p_report ->> 'vapi_call_id',
    p_report ->> 'caller_stated_urgency',
    p_report ->> 'caller_urgency_quote',
    p_report ->> 'extraction_status',
    p_report ->> 'model',
    p_report ->> 'prompt_version',
    nullif(p_report -> 'llm_output', 'null'::jsonb),
    (p_report ->> 'latency_ms')::integer,
    p_report ->> 'error'
  )
  on conflict (vapi_call_id) do nothing
  returning id into v_report_id;

  if v_report_id is null then
    return null;
  end if;

  insert into public.work_orders (
    report_id, position, issue_type, priority, model_priority, priority_source, priority_reason,
    model_rationale, unit, area, summary, source_quote, missing_fields, grounding_notes,
    needs_followup
  )
  select
    v_report_id,
    (o ->> 'position')::smallint,
    o ->> 'issue_type',
    o ->> 'priority',
    o ->> 'model_priority',
    o ->> 'priority_source',
    o ->> 'priority_reason',
    o ->> 'model_rationale',
    o ->> 'unit',
    o ->> 'area',
    o ->> 'summary',
    o ->> 'source_quote',
    array(select jsonb_array_elements_text(o -> 'missing_fields')),
    array(select jsonb_array_elements_text(o -> 'grounding_notes')),
    (o ->> 'needs_followup')::boolean
  from jsonb_array_elements(p_orders) as o;

  return v_report_id;
end;
$$;

create function public.check_intake_rate(p_ip_hash text, p_max_per_minute integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_recent integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));
  delete from public.intake_events where created_at < now() - interval '1 hour';
  select count(*) into v_recent
    from public.intake_events
    where ip_hash = p_ip_hash and created_at > now() - interval '1 minute';
  if v_recent >= p_max_per_minute then
    return false;
  end if;
  insert into public.intake_events (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

alter table public.reports enable row level security;
alter table public.work_orders enable row level security;
alter table public.intake_events enable row level security;

revoke all on public.reports, public.work_orders, public.intake_events from anon, authenticated;
grant select on public.reports, public.work_orders to anon, authenticated;
grant select, insert, update, delete
  on public.reports, public.work_orders, public.intake_events to service_role;

create policy "Dashboard reads reports" on public.reports
  for select to anon, authenticated using (true);
create policy "Dashboard reads work orders" on public.work_orders
  for select to anon, authenticated using (true);

revoke execute on function public.create_report_with_work_orders(jsonb, jsonb)
  from public, anon, authenticated;
revoke execute on function public.check_intake_rate(text, integer)
  from public, anon, authenticated;
grant execute on function public.create_report_with_work_orders(jsonb, jsonb) to service_role;
grant execute on function public.check_intake_rate(text, integer) to service_role;

alter publication supabase_realtime add table public.work_orders;
