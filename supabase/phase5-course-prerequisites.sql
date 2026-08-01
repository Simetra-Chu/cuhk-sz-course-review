-- Phase 5 补充：课程先修 / 同修 / 互斥
-- 在 Supabase SQL Editor 中运行一次

alter table public.courses
  add column if not exists prerequisite text,
  add column if not exists corequisite text,
  add column if not exists exclusion text;
