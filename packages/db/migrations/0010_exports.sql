create table export_bundle (
  id text primary key,
  unit_id text not null,
  version_number integer not null,
  payload_sha256 text not null,
  lesson_versions_json jsonb not null,
  held_back_json jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now()
);
