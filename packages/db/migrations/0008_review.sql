create table suggestion (
  id text primary key,
  lesson_id text not null,
  anchor_start text not null,
  anchor_end text not null,
  selected_text text not null,
  note text,
  suggested_text text not null,
  status text not null,
  requested_by text not null,
  decided_by text,
  decided_at timestamptz,
  expires_at timestamptz not null,
  model_call_id text not null
);

create table review_event (
  id text primary key,
  lesson_id text not null,
  version_id text,
  from_state text not null,
  to_state text not null,
  actor_id text not null,
  reason text,
  reason_tag text,
  note text,
  content_hash text,
  request_id text,
  at timestamptz not null default now()
);

create table audit_event (
  id text primary key,
  actor_id text,
  action text not null,
  target_kind text not null,
  target_id text not null,
  version_hash text,
  reason text,
  details_json jsonb not null default '{}',
  request_id text,
  store_id text,
  at timestamptz not null default now()
);

create function reject_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'append-only: %', tg_table_name;
end $$;

create trigger review_event_append_only before update or delete on review_event
  for each row execute function reject_mutation();
create trigger audit_event_append_only before update or delete on audit_event
  for each row execute function reject_mutation();

create view audit_log_v as
select * from (
  select r.at, 'review_event'::text as source, r.lesson_id, r.actor_id, u.name as actor_name,
         'lesson.transition'::text as action, r.from_state, r.to_state,
         r.content_hash as version_hash, r.reason
    from review_event r left join app_user u on u.id = r.actor_id
  union all
  select a.at, 'audit_event'::text,
         coalesce(case when a.target_kind = 'lesson' then a.target_id end, a.details_json ->> 'lesson_id'),
         a.actor_id, u.name, a.action, null::text, null::text, a.version_hash, a.reason
    from audit_event a left join app_user u on u.id = a.actor_id
) t order by at;
