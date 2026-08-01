-- 自定义标签上限：1 → 2
-- 在 Supabase SQL Editor 中运行一次

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
