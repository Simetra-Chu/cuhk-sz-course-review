-- Phase 10b: reviews 表也支持导入来源标记（飞书评分映射到站点评价区）
-- 在正式库 SQL Editor 执行一次

alter table public.reviews
  add column if not exists is_imported boolean not null default false;

alter table public.reviews
  add column if not exists source text;

create index if not exists idx_reviews_import_source
  on public.reviews (source)
  where is_imported = true;

comment on column public.reviews.is_imported is
  '批量导入标记；可与 source 一起清理测试/抽样数据';
comment on column public.reviews.source is
  '导入来源，例如 feishu_sample';

-- 一键清空本批飞书抽样评分：
-- delete from public.reviews
-- where is_imported = true and source = 'feishu_sample';
