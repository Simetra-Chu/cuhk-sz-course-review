-- Phase 7 补充：讨论区一层回复（parent_id）
-- 若已运行 phase7-discussions-likes.sql，再运行本文件一次

alter table public.discussion_posts
  add column if not exists parent_id uuid
    references public.discussion_posts(id) on delete cascade;

create index if not exists idx_discussion_posts_parent
on public.discussion_posts (parent_id, created_at asc)
where parent_id is not null;

-- 回复只能挂在顶层帖下（禁止楼中楼）
create or replace function public.trg_discussion_posts_parent_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_row public.discussion_posts%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  select * into parent_row
  from public.discussion_posts
  where id = new.parent_id;

  if not found then
    raise exception '回复的原帖不存在';
  end if;

  if parent_row.parent_id is not null then
    raise exception '只能回复顶层讨论，不能回复楼中楼';
  end if;

  if parent_row.course_id <> new.course_id then
    raise exception '回复必须属于同一门课程';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_discussion_posts_parent_check on public.discussion_posts;
create trigger trg_discussion_posts_parent_check
before insert or update of parent_id, course_id
on public.discussion_posts
for each row execute function public.trg_discussion_posts_parent_check();
