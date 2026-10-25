create table app_user (
  id text primary key,
  email text not null,
  name text not null,
  role text not null,
  synthetic boolean not null default false,
  password_hash text not null
);
create unique index app_user_email_lower on app_user (lower(email));

create table app_session (
  token_hash text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
