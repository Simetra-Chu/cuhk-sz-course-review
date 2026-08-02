-- 评价与评分分离：rating / difficulty / grading 可为空
-- 在 Supabase SQL Editor 中运行一次

alter table public.reviews
  alter column rating drop not null,
  alter column difficulty drop not null,
  alter column grading drop not null;

alter table public.reviews
  drop constraint if exists reviews_rating_check,
  drop constraint if exists reviews_difficulty_check,
  drop constraint if exists reviews_grading_check;

alter table public.reviews
  add constraint reviews_rating_check
    check (rating is null or rating between 1 and 5),
  add constraint reviews_difficulty_check
    check (difficulty is null or difficulty between 1 and 5),
  add constraint reviews_grading_check
    check (grading is null or grading between 1 and 5);

-- 均分只统计已评分的评价；review_count 仍统计全部可见评价
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
      round(avg(rating) filter (where rating is not null)::numeric, 2) as avg_rating,
      round(avg(difficulty) filter (where difficulty is not null)::numeric, 2) as avg_difficulty,
      round(avg(grading) filter (where grading is not null)::numeric, 2) as avg_grading,
      count(*)::integer as review_count
    from public.reviews
    where course_id = p_course_id
      and status = 'visible'
  ) s
  where c.id = p_course_id;
end;
$$;
