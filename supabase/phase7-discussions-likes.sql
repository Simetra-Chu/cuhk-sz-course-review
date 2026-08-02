-- Phase 7：课程讨论区 + 评价/讨论点赞
-- 在 Supabase SQL Editor 中运行一次

do $$ begin
  create type public.like_target_type as enum ('review', 'discussion_post');
exception
  when duplicate_object then null;
end $$;

alter table public.reviews
  add column if not exists like_count integer not null default 0;

alter table public.reviews
  drop constraint if exists reviews_like_count_nonnegative;

alter table public.reviews
  add constraint reviews_like_count_nonnegative
  check (like_count >= 0);

create table if not exists public.discussion_posts (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null
    check (
      char_length(trim(content)) >= 8
      and char_length(trim(content)) <= 1000
    ),
  status public.review_status not null default 'visible',
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_discussion_posts_course_visible
on public.discussion_posts (course_id, created_at desc)
where status = 'visible';

create index if not exists idx_discussion_posts_user
on public.discussion_posts (user_id);

drop trigger if exists trg_discussion_posts_updated_at on public.discussion_posts;
create trigger trg_discussion_posts_updated_at
before update on public.discussion_posts
for each row execute function public.set_updated_at();

create table if not exists public.content_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type public.like_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists idx_content_likes_target
on public.content_likes (target_type, target_id);

create or replace function public.trg_refresh_content_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type public.like_target_type;
  v_id uuid;
  v_delta integer;
begin
  if tg_op = 'INSERT' then
    v_type := new.target_type;
    v_id := new.target_id;
    v_delta := 1;
  elsif tg_op = 'DELETE' then
    v_type := old.target_type;
    v_id := old.target_id;
    v_delta := -1;
  else
    return coalesce(new, old);
  end if;

  if v_type = 'review' then
    update public.reviews
    set like_count = greatest(0, like_count + v_delta),
        updated_at = now()
    where id = v_id;
  elsif v_type = 'discussion_post' then
    update public.discussion_posts
    set like_count = greatest(0, like_count + v_delta),
        updated_at = now()
    where id = v_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_content_likes_refresh_count on public.content_likes;
create trigger trg_content_likes_refresh_count
after insert or delete on public.content_likes
for each row execute function public.trg_refresh_content_like_count();

alter table public.discussion_posts enable row level security;
alter table public.content_likes enable row level security;

drop policy if exists "discussion_posts_public_read_visible" on public.discussion_posts;
create policy "discussion_posts_public_read_visible"
on public.discussion_posts for select
to anon, authenticated
using (status = 'visible');

drop policy if exists "discussion_posts_read_own" on public.discussion_posts;
create policy "discussion_posts_read_own"
on public.discussion_posts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "discussion_posts_insert_own" on public.discussion_posts;
create policy "discussion_posts_insert_own"
on public.discussion_posts for insert
to authenticated
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "discussion_posts_update_own" on public.discussion_posts;
create policy "discussion_posts_update_own"
on public.discussion_posts for update
to authenticated
using (auth.uid() = user_id and public.is_school_email())
with check (auth.uid() = user_id and public.is_school_email());

drop policy if exists "discussion_posts_delete_own" on public.discussion_posts;
create policy "discussion_posts_delete_own"
on public.discussion_posts for delete
to authenticated
using (auth.uid() = user_id and public.is_school_email());

drop policy if exists "content_likes_read_own" on public.content_likes;
create policy "content_likes_read_own"
on public.content_likes for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "content_likes_insert_own" on public.content_likes;
create policy "content_likes_insert_own"
on public.content_likes for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.is_school_email()
  and (
    (
      target_type = 'review'
      and exists (
        select 1 from public.reviews r
        where r.id = target_id and r.status = 'visible'
      )
    )
    or (
      target_type = 'discussion_post'
      and exists (
        select 1 from public.discussion_posts d
        where d.id = target_id and d.status = 'visible'
      )
    )
  )
);

drop policy if exists "content_likes_delete_own" on public.content_likes;
create policy "content_likes_delete_own"
on public.content_likes for delete
to authenticated
using (auth.uid() = user_id and public.is_school_email());
