-- migrate:up
create table notes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index notes_user_id_created_at_idx on notes (user_id, created_at desc);

-- migrate:down
drop table notes;
