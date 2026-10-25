create table judge_verdict (
  id text primary key,
  lesson_id text not null,
  content_hash text not null,
  address text not null,
  code text not null,
  question text not null,
  verdict text not null,
  model_call_id text,
  served_model text
);
