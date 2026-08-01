-- ============================================================
-- 港中深课程评价平台 · Phase 1 数据库 Schema
-- 在 Supabase Dashboard → SQL Editor → New query 中粘贴并 Run
-- ============================================================

-- 1. 扩展（模糊搜索用）
create extension if not exists pg_trgm;

-- 2. 枚举类型
create type public.feedback_category as enum (
  'missing_course',
  'bug',
  'suggestion',
  'other'
);

create type public.school_code as enum (
  'SSE', 'SME', 'SDS', 'HSS', 'MED', 'MUS', 'SAI', 'FE'
);

create type public.review_status as enum ('visible', 'hidden');

create or replace function public.valid_review_tags(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(coalesce(p_tags, '{}'::text[])) <= 5
    and (
      select count(*) = count(distinct tag)
      from unnest(coalesce(p_tags, '{}'::text[])) as tag
    )
    and not exists (
      select 1
      from unnest(coalesce(p_tags, '{}'::text[])) as tag
      where tag <> trim(tag)
        or char_length(tag) < 2
        or char_length(tag) > 8
    )
    and (
      select count(*)
      from unnest(coalesce(p_tags, '{}'::text[])) as tag
      where tag <> all(array[
        '给分慷慨', '给分严格', '作业适中', '作业量大',
        '推荐', '避雷', '签到少', '点名频繁'
      ]::text[])
    ) <= 1;
$$;

-- 3. 课程表
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_cn text not null,
  name_en text,
  school public.school_code not null,
  subject_code text,
  subject_name text,
  source text not null default 'manual'
    check (source in ('manual', 'sis', 'registry')),
  source_url text,
  offered_terms text[] not null default '{}',
  prerequisite text,
  corequisite text,
  exclusion text,
  last_synced_at timestamptz,
  avg_rating numeric(3, 2) not null default 0,
  avg_difficulty numeric(3, 2) not null default 0,
  avg_grading numeric(3, 2) not null default 0,
  review_count integer not null default 0,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. 评价表（每用户每课程仅一条）
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  difficulty smallint not null check (difficulty between 1 and 5),
  grading smallint not null check (grading between 1 and 5),
  tags text[] not null default '{}' check (public.valid_review_tags(tags)),
  content text not null check (char_length(trim(content)) > 15),
  status public.review_status not null default 'visible',
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- 5. 举报表（每用户每评价仅一次）
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

-- 6. 求评价表（每用户每课程仅一次）
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- 7b. 用户反馈
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

-- 7. 推荐教授专栏（仅推荐留言，不汇总票数）
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

-- 6. 索引
create index if not exists idx_courses_school on public.courses (school);
create index if not exists idx_courses_code_trgm on public.courses using gin (code gin_trgm_ops);
create index if not exists idx_courses_name_cn_trgm on public.courses using gin (name_cn gin_trgm_ops);
create index if not exists idx_reviews_course_visible on public.reviews (course_id) where status = 'visible';
create index if not exists idx_reviews_user on public.reviews (user_id);
create index if not exists idx_reviews_recent_visible on public.reviews (created_at desc) where status = 'visible';
create index if not exists idx_review_requests_course on public.review_requests (course_id);
create index if not exists idx_review_requests_user on public.review_requests (user_id);
create index if not exists idx_courses_request_count on public.courses (request_count desc);
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
create index if not exists idx_feedback_created_at
on public.feedback (created_at desc);
create index if not exists idx_feedback_category
on public.feedback (category);

-- 7. 自动更新 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

drop trigger if exists trg_prof_rec_updated_at on public.professor_recommendations;
create trigger trg_prof_rec_updated_at
before update on public.professor_recommendations
for each row execute function public.set_updated_at();

-- 8. 评价变更时，重算课程统计
create or replace function public.refresh_course_stats(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses c
  set
    avg_rating = coalesce(s.avg_rating, 0),
    avg_difficulty = coalesce(s.avg_difficulty, 0),
    avg_grading = coalesce(s.avg_grading, 0),
    review_count = coalesce(s.review_count, 0),
    updated_at = now()
  from (
    select
      round(avg(rating)::numeric, 2) as avg_rating,
      round(avg(difficulty)::numeric, 2) as avg_difficulty,
      round(avg(grading)::numeric, 2) as avg_grading,
      count(*)::integer as review_count
    from public.reviews
    where course_id = p_course_id
      and status = 'visible'
  ) s
  where c.id = p_course_id;
end;
$$;

create or replace function public.trg_refresh_course_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course_id uuid;
begin
  target_course_id := coalesce(new.course_id, old.course_id);
  perform public.refresh_course_stats(target_course_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reviews_refresh_stats on public.reviews;
create trigger trg_reviews_refresh_stats
after insert or update or delete on public.reviews
for each row execute function public.trg_refresh_course_stats();

-- 9. 举报时更新计数，>=3 自动隐藏
create or replace function public.trg_handle_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course_id uuid;
begin
  update public.reviews
  set
    report_count = report_count + 1,
    status = case when report_count + 1 >= 3 then 'hidden'::public.review_status else status end,
    updated_at = now()
  where id = new.review_id
  returning course_id into target_course_id;

  perform public.refresh_course_stats(target_course_id);
  return new;
end;
$$;

drop trigger if exists trg_reports_handle on public.reports;
create trigger trg_reports_handle
after insert on public.reports
for each row execute function public.trg_handle_report();

-- 10. 求评价变更时更新计数
create or replace function public.refresh_course_request_count(p_course_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.courses
  set
    request_count = (
      select count(*)::integer
      from public.review_requests
      where course_id = p_course_id
    ),
    updated_at = now()
  where id = p_course_id;
end;
$$;

create or replace function public.trg_refresh_course_request_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_course_id uuid;
begin
  target_course_id := coalesce(new.course_id, old.course_id);
  perform public.refresh_course_request_count(target_course_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_requests_refresh_count on public.review_requests;
create trigger trg_review_requests_refresh_count
after insert or delete on public.review_requests
for each row execute function public.trg_refresh_course_request_count();

-- 10. 启用 RLS
alter table public.courses enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.review_requests enable row level security;
alter table public.professor_recommendations enable row level security;
alter table public.feedback enable row level security;

-- 仅允许港中深校内邮箱执行写操作
create or replace function public.is_school_email()
returns boolean
language sql
stable
set search_path = ''
as $$
  select right(
    lower(coalesce(auth.jwt() ->> 'email', '')),
    length('@link.cuhk.edu.cn')
  ) = '@link.cuhk.edu.cn';
$$;

-- 11. RLS 策略
drop policy if exists "courses_public_read" on public.courses;
create policy "courses_public_read"
on public.courses for select
to anon, authenticated
using (true);

drop policy if exists "reviews_public_read_visible" on public.reviews;
create policy "reviews_public_read_visible"
on public.reviews for select
to anon, authenticated
using (status = 'visible');

drop policy if exists "reviews_read_own" on public.reviews;
create policy "reviews_read_own"
on public.reviews for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
on public.reviews for insert
to authenticated
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
on public.reviews for update
to authenticated
using (auth.uid() = user_id and public.is_school_email())
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
on public.reviews for delete
to authenticated
using (auth.uid() = user_id and public.is_school_email());

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
on public.reports for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_school_email()
  and exists (
    select 1
    from public.reviews
    where reviews.id = reports.review_id
      and reviews.user_id <> auth.uid()
  )
);

drop policy if exists "review_requests_read_own" on public.review_requests;
create policy "review_requests_read_own"
on public.review_requests for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "review_requests_insert_own" on public.review_requests;
create policy "review_requests_insert_own"
on public.review_requests for insert
to authenticated
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "review_requests_delete_own" on public.review_requests;
create policy "review_requests_delete_own"
on public.review_requests for delete
to authenticated
using (auth.uid() = user_id and public.is_school_email());

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

drop policy if exists "feedback_insert_public" on public.feedback;
create policy "feedback_insert_public"
on public.feedback for insert
to anon, authenticated
with check (
  user_id is null
  or auth.uid() = user_id
);

drop policy if exists "feedback_read_own" on public.feedback;
create policy "feedback_read_own"
on public.feedback for select
to authenticated
using (auth.uid() = user_id);
