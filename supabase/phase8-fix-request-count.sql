-- 修复 / 重建「求评价」计数触发器，并回填 courses.request_count
-- 在 Supabase SQL Editor 中运行一次

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

-- 前端点击后也会主动调用，需授权
grant execute on function public.refresh_course_request_count(uuid) to authenticated;
grant execute on function public.refresh_course_request_count(uuid) to service_role;
grant execute on function public.refresh_course_request_count(uuid) to anon;

-- 回填全部课程计数（修复历史未触发导致的 0）
update public.courses c
set request_count = coalesce((
  select count(*)::integer
  from public.review_requests r
  where r.course_id = c.id
), 0);
