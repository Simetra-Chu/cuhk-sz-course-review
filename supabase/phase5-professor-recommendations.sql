-- Phase 5：课程下「推荐教授」专栏（仅推荐、不汇总票数）
-- 在 Supabase SQL Editor 中运行一次

create table if not exists public.professor_recommendations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  professor_name text not null
    check (
      char_length(trim(professor_name)) >= 2
      and char_length(trim(professor_name)) <= 40
    ),
  content text not null
    check (char_length(trim(content)) >= 8),
  status public.review_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同一用户对同一课程的同一教授名只保留一条推荐
create unique index if not exists uq_prof_rec_course_user_name
on public.professor_recommendations (
  course_id,
  user_id,
  lower(trim(professor_name))
);

create index if not exists idx_prof_rec_course_visible
on public.professor_recommendations (course_id, created_at desc)
where status = 'visible';

create index if not exists idx_prof_rec_user
on public.professor_recommendations (user_id);

drop trigger if exists trg_prof_rec_updated_at on public.professor_recommendations;
create trigger trg_prof_rec_updated_at
before update on public.professor_recommendations
for each row execute function public.set_updated_at();

alter table public.professor_recommendations enable row level security;

drop policy if exists "prof_rec_public_read_visible" on public.professor_recommendations;
create policy "prof_rec_public_read_visible"
on public.professor_recommendations for select
to anon, authenticated
using (status = 'visible');

drop policy if exists "prof_rec_read_own" on public.professor_recommendations;
create policy "prof_rec_read_own"
on public.professor_recommendations for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "prof_rec_insert_own" on public.professor_recommendations;
create policy "prof_rec_insert_own"
on public.professor_recommendations for insert
to authenticated
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "prof_rec_update_own" on public.professor_recommendations;
create policy "prof_rec_update_own"
on public.professor_recommendations for update
to authenticated
using (auth.uid() = user_id and public.is_school_email())
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "prof_rec_delete_own" on public.professor_recommendations;
create policy "prof_rec_delete_own"
on public.professor_recommendations for delete
to authenticated
using (auth.uid() = user_id and public.is_school_email());
