create table prompt_version (
  id text primary key,
  locked_hash text not null,
  guidance_text text not null,
  number integer not null,
  author_id text,
  reason text,
  diff text,
  created_at timestamptz not null default now()
);
