create table check_job (
  id bigserial primary key,
  lesson_id text not null,
  content_hash text not null,
  store_id text not null,
  status text not null,
  enqueued_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  lease_until timestamptz
);
create unique index check_job_one_queued on check_job (lesson_id) where status = 'queued';

create table issue (
  id text primary key,
  lesson_id text not null,
  content_hash text not null,
  level text not null,
  kind text not null,
  message text not null,
  address text,
  span_anchor text,
  related_lesson_id text,
  code text,
  resolved_by text,
  resolution_reason text,
  resolved_at timestamptz,
  cleared_by text,
  created_at timestamptz not null default now()
);

create table alignment_link (
  lesson_id text not null,
  content_hash text not null,
  code text not null,
  address text not null,
  role text not null,
  origin text not null,
  asserted_by text not null,
  confirmed_by text,
  primary key (lesson_id, content_hash, code, address)
);

create table safety_flag (
  id text primary key,
  lesson_id text not null,
  source_row integer not null,
  teacher_tip_address text,
  status text not null,
  cleared_by text,
  note text,
  cleared_at timestamptz
);
