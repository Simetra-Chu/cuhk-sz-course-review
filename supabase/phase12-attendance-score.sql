-- Phase 12：评价增加「签到频率」独立评分（1–5，可选）
-- 在 Supabase SQL Editor（Production）中运行一次

-- 1) reviews.attendance
alter table public.reviews
  add column if not exists attendance smallint;

alter table public.reviews
  drop constraint if exists reviews_attendance_check;

alter table public.reviews
  add constraint reviews_attendance_check
  check (attendance is null or attendance between 1 and 5);

comment on column public.reviews.attendance is
  '签到频率：1 很少/几乎不 → 5 很频繁；可空表示未评';

-- 2) courses.avg_attendance
alter table public.courses
  add column if not exists avg_attendance numeric(3, 2) not null default 0;

comment on column public.courses.avg_attendance is
  '可见评价中签到频率均分（仅统计 attendance 非空）';

-- 3) 预设标签：签到相关改由 attendance 指标表达，不再作为可选预设
create or replace function public.valid_review_tags(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(coalesce(p_tags, '{}'::text[])) <= 5
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
        '推荐', '避雷',
        -- 历史数据兼容：旧评价上的签到标签仍视为合法预设
        '签到少', '点名频繁'
      ]::text[])
    ) <= 2;
$$;

-- 4) 均分统计纳入 attendance
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
    avg_attendance = coalesce(s.avg_attendance, 0),
    review_count = coalesce(s.review_count, 0),
    updated_at = now()
  from (
    select
      round(avg(rating) filter (where rating is not null)::numeric, 2) as avg_rating,
      round(avg(difficulty) filter (where difficulty is not null)::numeric, 2) as avg_difficulty,
      round(avg(grading) filter (where grading is not null)::numeric, 2) as avg_grading,
      round(avg(attendance) filter (where attendance is not null)::numeric, 2) as avg_attendance,
      count(*)::integer as review_count
    from public.reviews
    where course_id = p_course_id
      and status = 'visible'
  ) s
  where c.id = p_course_id;
end;
$$;

-- 5) 回填已有课程均分
do $$
declare
  cid uuid;
begin
  for cid in select id from public.courses
  loop
    perform public.refresh_course_stats(cid);
  end loop;
end $$;
