-- NL-89 / NL-08: judge_verdict is append-only (R-35). reject_mutation() is defined in 0008_review.sql.
alter table judge_verdict add column created_at timestamptz not null default now();
create trigger judge_verdict_append_only before update or delete on judge_verdict
  for each row execute function reject_mutation();
create trigger judge_verdict_no_truncate before truncate on judge_verdict
  for each statement execute function reject_mutation();
create unique index judge_verdict_pair_hash_question_key
  on judge_verdict (lesson_id, content_hash, address, code, question, model_call_id);
