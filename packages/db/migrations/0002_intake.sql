create table unit (
  id text primary key,
  grade integer not null,
  title text not null
);

create table outline_version (
  id text primary key,
  unit_id text not null,
  number integer not null,
  sha256 text not null,
  same_as_version integer,
  source_kind text not null,
  source_name text not null,
  uploaded_by text not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table outline_row (
  outline_version_id text not null,
  row_number integer not null,
  kind text not null,
  lesson_id text,
  segments_json jsonb not null,
  codes_json jsonb not null,
  findings_json jsonb not null,
  row_hash text not null,
  primary key (outline_version_id, row_number)
);

create table intake_choice (
  outline_version_id text not null,
  finding_id text not null,
  choice text not null,
  status text not null,
  confirmed_by text,
  primary key (outline_version_id, finding_id)
);

create table standard (
  code text primary key,
  "set" text not null,
  text text not null,
  parent_code text,
  is_leaf boolean not null,
  eld_strand text
);

create table lesson_link (
  id bigserial primary key,
  outline_version_id text not null,
  from_lesson_id text not null,
  to_lesson_id text not null,
  kind text not null,
  slot_id text not null
);
