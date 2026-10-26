-- Contract F3 R-F3-9: derive_alignment returns one row per (code, address, role): a code taught (I/P) and checked (A) at one
-- address is two rows. The key must carry the role, or the background check fails with a duplicate key. Widening a primary key
-- keeps every existing row valid (old keys were unique on a subset of the new columns). Role is NOT NULL already.
alter table alignment_link drop constraint alignment_link_pkey;
alter table alignment_link add primary key (lesson_id, content_hash, code, address, role);
