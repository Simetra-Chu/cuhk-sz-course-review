-- 评价文字说明改为可选：可只评分/标签；若填写则仍至少 16 字
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
      and t.relname = 'reviews'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%content%'
  loop
    execute format('alter table public.reviews drop constraint %I', cname);
  end loop;
end $$;

alter table public.reviews
  alter column content set default '';

alter table public.reviews
  add constraint reviews_content_check
  check (
    char_length(trim(content)) = 0
    or char_length(trim(content)) > 15
  );
