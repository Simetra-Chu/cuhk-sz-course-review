-- Phase 6：用户反馈（缺课、问题、建议）
-- 在 Supabase SQL Editor 中运行一次

do $$ begin
  create type public.feedback_category as enum (
    'missing_course',
    'bug',
    'suggestion',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  category public.feedback_category not null,
  content text not null
    check (
      char_length(trim(content)) >= 10
      and char_length(trim(content)) <= 2000
    ),
  course_code text
    check (
      course_code is null
      or (
        char_length(trim(course_code)) >= 2
        and char_length(trim(course_code)) <= 20
      )
    ),
  contact_email text
    check (
      contact_email is null
      or (
        char_length(trim(contact_email)) >= 5
        and char_length(trim(contact_email)) <= 120
      )
    ),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_created_at
on public.feedback (created_at desc);

create index if not exists idx_feedback_category
on public.feedback (category);

alter table public.feedback enable row level security;

-- 任何人可提交反馈（含未登录）
drop policy if exists "feedback_insert_public" on public.feedback;
create policy "feedback_insert_public"
on public.feedback for insert
to anon, authenticated
with check (
  user_id is null
  or auth.uid() = user_id
);

-- 登录用户可查看自己提交的反馈
drop policy if exists "feedback_read_own" on public.feedback;
create policy "feedback_read_own"
on public.feedback for select
to authenticated
using (auth.uid() = user_id);
