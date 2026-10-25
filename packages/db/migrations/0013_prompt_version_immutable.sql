-- NL-34 / NL-08: prompt_version is append-only (CON-24). reject_mutation() is defined in 0008_review.sql.
create unique index prompt_version_number_key on prompt_version (number);
create trigger prompt_version_append_only before update or delete on prompt_version
  for each row execute function reject_mutation();
create trigger prompt_version_no_truncate before truncate on prompt_version
  for each statement execute function reject_mutation();
