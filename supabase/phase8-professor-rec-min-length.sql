-- 教授推荐正文最少字数：8 → 1
-- 在 Supabase SQL Editor 中运行一次

do $$
declare
  cname text;
begin
  for cname in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'professor_recommendations'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%content%'
  loop
    execute format(
      'alter table public.professor_recommendations drop constraint %I',
      cname
    );
  end loop;
end $$;

alter table public.professor_recommendations
  add constraint professor_recommendations_content_check
  check (char_length(trim(content)) >= 1);
