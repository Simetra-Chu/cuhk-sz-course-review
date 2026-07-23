-- Phase 2：为课程记录增加可追溯的数据来源
-- 在 Supabase SQL Editor 中运行一次

alter table public.courses
  add column if not exists subject_code text,
  add column if not exists subject_name text,
  add column if not exists source text not null default 'manual',
  add column if not exists source_url text,
  add column if not exists offered_terms text[] not null default '{}',
  add column if not exists last_synced_at timestamptz;

alter table public.courses
  drop constraint if exists courses_source_check;

alter table public.courses
  add constraint courses_source_check
  check (source in ('manual', 'sis', 'registry'));

create index if not exists idx_courses_subject_code
on public.courses (subject_code);
