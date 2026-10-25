create table schema_migrations (
  id text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
