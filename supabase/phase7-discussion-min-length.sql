-- 讨论/回复最少字数：8 → 1
-- 在 Supabase SQL Editor 中运行一次

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on c.conrelid = t.oid
  join pg_namespace n on t.relnamespace = n.oid
  where n.nspname = 'public'
    and t.relname = 'discussion_posts'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) ilike '%content%';

  if constraint_name is not null then
    execute format(
      'alter table public.discussion_posts drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.discussion_posts
  add constraint discussion_posts_content_check
  check (
    char_length(trim(content)) >= 1
    and char_length(trim(content)) <= 1000
  );
