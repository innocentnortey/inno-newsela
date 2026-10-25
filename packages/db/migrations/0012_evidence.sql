create table eval_run (
  id text primary key,
  suite text not null,
  git_sha text not null,
  prompt_version_id text,
  models_json jsonb not null,
  provider_mode text not null,
  case_set text not null,
  run_id text,
  report_path text,
  passed integer not null default 0,
  total integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table eval_case_result (
  eval_run_id text not null,
  case_id text not null,
  provenance text not null,
  source text not null,
  guards text not null,
  passed boolean not null,
  failure_category text,
  expected_json jsonb not null,
  actual_json jsonb not null,
  primary key (eval_run_id, case_id)
);

create table probe_run (
  id text primary key,
  kind text not null,
  users integer not null,
  duration_s integer not null,
  machine text not null,
  provider_mode text not null,
  p95_json jsonb not null,
  error_rate numeric not null,
  lost_updates integer not null,
  event_loop_lag_p95_ms numeric not null,
  max_db_connections integer not null,
  n integer not null
);

create table experiment_run (
  id text primary key,
  config_json jsonb not null,
  result_json jsonb not null,
  report_path text,
  imported_at timestamptz not null default now()
);

create table ops_event (
  id text primary key,
  kind text not null,
  build_id text not null,
  service text not null,
  details_json jsonb not null default '{}',
  at timestamptz not null default now()
);
