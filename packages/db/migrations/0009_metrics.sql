create table heartbeat (
  id bigserial primary key,
  user_id text not null,
  tab_id text not null,
  lesson_id text not null,
  version_id text not null,
  at timestamptz not null default now(),
  synthetic boolean not null default false
);

create table review_session (
  id bigserial primary key,
  user_id text not null,
  lesson_id text not null,
  version_id text not null,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  active_seconds integer not null default 0,
  synthetic boolean not null default false
);

create table lesson_metrics (
  lesson_id text primary key,
  version_id text not null,
  active_minutes numeric(10,2) not null,
  teacher_word_count integer not null,
  g2_threshold_minutes numeric(10,2) not null,
  draft_rating integer,
  human_sessions integer not null,
  approved_at timestamptz not null
);
create trigger lesson_metrics_append_only before update or delete on lesson_metrics
  for each row execute function reject_mutation();
