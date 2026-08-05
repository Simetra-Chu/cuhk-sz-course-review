-- Phase 11：允许多条教授评价；导入账号可同课多条评分/求评价
-- 在 Supabase SQL Editor（Production）中运行一次
--
-- 导入账号（飞书抽样写入）：20feb4f8-023f-43db-8ae1-d31cba672dbc
-- 其他账号仍保持「每课一条评分 / 每课一次求评价」

-- 1) 教授推荐：取消「同课+同用户+同教授」唯一索引
drop index if exists public.uq_prof_rec_course_user_name;

create index if not exists idx_prof_rec_course_user_name
on public.professor_recommendations (
  course_id,
  user_id,
  lower(trim(professor_name))
);

-- 2) reviews：普通用户仍唯一；导入账号可多条
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'reviews'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) ilike '%course_id%'
      and pg_get_constraintdef(con.oid) ilike '%user_id%'
  loop
    execute format('alter table public.reviews drop constraint %I', cname);
  end loop;
end $$;

drop index if exists public.uq_reviews_course_user_non_importer;
create unique index uq_reviews_course_user_non_importer
on public.reviews (course_id, user_id)
where user_id <> '20feb4f8-023f-43db-8ae1-d31cba672dbc'::uuid;

-- 3) review_requests：同上，便于按活跃度写入多份「求评价」权重
do $$
declare
  cname text;
begin
  for cname in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'review_requests'
      and con.contype = 'u'
      and pg_get_constraintdef(con.oid) ilike '%course_id%'
      and pg_get_constraintdef(con.oid) ilike '%user_id%'
  loop
    execute format('alter table public.review_requests drop constraint %I', cname);
  end loop;
end $$;

drop index if exists public.uq_review_requests_course_user_non_importer;
create unique index uq_review_requests_course_user_non_importer
on public.review_requests (course_id, user_id)
where user_id <> '20feb4f8-023f-43db-8ae1-d31cba672dbc'::uuid;

alter table public.review_requests
  add column if not exists is_imported boolean not null default false;

alter table public.review_requests
  add column if not exists source text;

create index if not exists idx_review_requests_source
  on public.review_requests (source)
  where source is not null;

comment on column public.review_requests.is_imported is
  '脚本导入的求评价权重行，可按 source 批量清理';
comment on column public.review_requests.source is
  '导入来源标记，例如 feishu_sample';

-- 上榜均分已由 refresh_course_stats 对 visible reviews 做算术平均；
-- 多条导入评分写入后触发器会自动刷新 courses.avg_* / review_count / request_count。
