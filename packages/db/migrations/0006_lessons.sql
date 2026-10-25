create table lesson (
  id text primary key,
  unit_id text not null,
  number integer,
  type text not null,
  title text not null,
  state text not null,
  current_version_id text,
  reviewer_id text,
  last_editor_id text,
  schema_version integer not null
);

create table lesson_version (
  id text primary key,
  lesson_id text not null,
  number integer not null,
  kind text not null,
  adopted boolean not null default false,
  content_hash text not null,
  state_vector bytea,
  lesson_json jsonb not null,
  draft_json jsonb,
  teacher_word_count integer not null,
  provenance_json jsonb not null,
  derived_from_version_id text,
  run_id text,
  model_call_ids jsonb not null default '[]',
  dependency_record_json jsonb not null default '[]',
  created_by text,
  stored_at timestamptz not null default now(),
  idempotency_key text,
  constraint lesson_version_idempotency_key_key unique (idempotency_key)
);

create function lesson_version_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'append-only: lesson_version';
  end if;
  if new.content_hash is distinct from old.content_hash
     or new.state_vector is distinct from old.state_vector
     or new.lesson_json is distinct from old.lesson_json
     or new.draft_json is distinct from old.draft_json
     or new.provenance_json is distinct from old.provenance_json
     or new.dependency_record_json is distinct from old.dependency_record_json
     or (old.adopted and not new.adopted)
  then
    raise exception 'append-only: lesson_version';
  end if;
  return new;
end $$;

create trigger lesson_version_guard before update or delete on lesson_version
  for each row execute function lesson_version_guard();

create table lesson_doc (
  lesson_id text not null,
  seq integer not null,
  store_id text not null,
  ydoc_bytes bytea not null,
  derived_json jsonb not null,
  content_hash text not null,
  state_vector bytea not null,
  schema_version integer not null,
  stored_by text,
  stored_at timestamptz not null default now(),
  request_id text,
  primary key (lesson_id, seq)
);
