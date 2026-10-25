create table run (
  id text primary key,
  unit_id text not null,
  outline_version_id text not null,
  kind text not null,
  state text not null,
  scope_json jsonb not null,
  parent_run_id text,
  prompt_version_id text not null,
  choices_json jsonb not null,
  choices_hash text not null,
  cap_usd numeric(12,6) not null,
  capped_by text,
  paused_check text,
  idempotency_key text not null,
  started_by text not null,
  plan_stored_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  eval_run_id text,
  constraint run_started_by_idempotency_key_key unique (started_by, idempotency_key)
);

create table unit_plan (
  run_id text primary key,
  state text not null,
  entries_json jsonb,
  lesson_links_json jsonb not null default '[]',
  model_call_id text,
  stored_at timestamptz
);

create table lesson_job (
  id text primary key,
  run_id text not null,
  kind text not null,
  lesson_id text,
  idempotency_key text,
  status text not null,
  tile_state text not null,
  attempt integer not null default 0,
  worker_id text,
  lease_until timestamptz,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  failure_reasons_json jsonb not null default '[]',
  brakes_fired jsonb not null default '[]',
  calls_lost integer not null default 0,
  repairs integer not null default 0,
  truncation_retries integer not null default 0,
  retries integer not null default 0,
  cost_usd numeric(12,6) not null default 0,
  reviewer_note text
);
create unique index lesson_job_one_candidate on lesson_job (lesson_id)
  where kind = 'candidate' and status in ('queued', 'running');

create table spend_reservation (
  id text primary key,
  run_id text,
  job_id text,
  user_id text not null,
  purpose text not null,
  model_call_id text,
  reserved_usd numeric(12,6) not null,
  settled_usd numeric(12,6) not null default 0,
  overshoot_usd numeric(12,6) not null default 0,
  status text not null,
  day text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
