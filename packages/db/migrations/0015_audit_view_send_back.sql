-- NL-126 F-7: expose the stored send-back tag and note through audit_log_v.
-- CREATE OR REPLACE VIEW only allows appending columns, so reason_tag and note go last.
create or replace view audit_log_v as
select * from (
  select r.at, 'review_event'::text as source, r.lesson_id, r.actor_id, u.name as actor_name,
         'lesson.transition'::text as action, r.from_state, r.to_state,
         r.content_hash as version_hash, r.reason,
         r.reason_tag, r.note
    from review_event r left join app_user u on u.id = r.actor_id
  union all
  select a.at, 'audit_event'::text,
         coalesce(case when a.target_kind = 'lesson' then a.target_id end, a.details_json ->> 'lesson_id'),
         a.actor_id, u.name, a.action, null::text, null::text, a.version_hash, a.reason,
         null::text, null::text
    from audit_event a left join app_user u on u.id = a.actor_id
) t order by at;
