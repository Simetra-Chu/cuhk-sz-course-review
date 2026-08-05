-- Phase 10: 导入来源标记（便于抽样导入后一键清空 / 审查）
-- 正式库 / DEV 均可执行。

alter table public.professor_recommendations
  add column if not exists is_imported boolean not null default false;

alter table public.professor_recommendations
  add column if not exists source text;

create index if not exists idx_prof_rec_import_source
  on public.professor_recommendations (source)
  where is_imported = true;

alter table public.discussion_posts
  add column if not exists is_imported boolean not null default false;

alter table public.discussion_posts
  add column if not exists source text;

create index if not exists idx_discussion_posts_import_source
  on public.discussion_posts (source)
  where is_imported = true;

comment on column public.professor_recommendations.is_imported is
  '批量导入标记；可与 source 一起用于清理测试数据';
comment on column public.professor_recommendations.source is
  '导入来源，例如 feishu_sample';

-- 一键清空本批飞书抽样（确认后再执行）：
-- delete from public.professor_recommendations
-- where is_imported = true and source = 'feishu_sample';
