-- 评论区支持标签（签到频率等自动标签）
-- 在 Supabase SQL Editor 中运行一次

create or replace function public.valid_discussion_tags(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(coalesce(p_tags, '{}'::text[])) <= 8
    and not exists (
      select 1
      from unnest(coalesce(p_tags, '{}'::text[])) as tag
      where char_length(trim(tag)) < 2
         or char_length(trim(tag)) > 12
         or tag <> trim(tag)
    );
$$;

alter table public.discussion_posts
  add column if not exists tags text[] not null default '{}';

alter table public.discussion_posts
  drop constraint if exists discussion_posts_tags_check;

alter table public.discussion_posts
  add constraint discussion_posts_tags_check
  check (public.valid_discussion_tags(tags));

comment on column public.discussion_posts.tags is '评论标签，如签到频率、给分等';
