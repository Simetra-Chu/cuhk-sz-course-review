-- Phase 4 补充：自定义标签、求评价、最新评价
-- 在 Supabase SQL Editor 中运行一次

alter table public.courses
  add column if not exists request_count integer not null default 0;

alter table public.courses
  drop constraint if exists courses_request_count_nonnegative;

alter table public.courses
  add constraint courses_request_count_nonnegative
  check (request_count >= 0);

create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

create index if not exists idx_review_requests_course
on public.review_requests (course_id);

create index if not exists idx_review_requests_user
on public.review_requests (user_id);

create index if not exists idx_courses_request_count
on public.courses (request_count desc);

create index if not exists idx_reviews_recent_visible
on public.reviews (created_at desc)
where status = 'visible';

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
    ) <= 2;
$$;

alter table public.reviews
  drop constraint if exists reviews_tags_valid;

alter table public.reviews
  add constraint reviews_tags_valid
  check (public.valid_review_tags(tags));

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

drop trigger if exists trg_review_requests_refresh_count
on public.review_requests;

create trigger trg_review_requests_refresh_count
after insert or delete on public.review_requests
for each row execute function public.trg_refresh_course_request_count();

alter table public.review_requests enable row level security;

drop policy if exists "review_requests_read_own"
on public.review_requests;
create policy "review_requests_read_own"
on public.review_requests for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "review_requests_insert_own"
on public.review_requests;
create policy "review_requests_insert_own"
on public.review_requests for insert
to authenticated
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "review_requests_delete_own"
on public.review_requests;
create policy "review_requests_delete_own"
on public.review_requests for delete
to authenticated
using (auth.uid() = user_id and public.is_school_email());

update public.courses c
set request_count = (
  select count(*)::integer
  from public.review_requests r
  where r.course_id = c.id
);
