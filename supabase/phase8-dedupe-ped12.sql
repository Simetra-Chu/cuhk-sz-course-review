-- 删除与 PED11xx 英文名相同的 PED12xx（保留 11xx）
-- 先合并学期与相关内容，再删除 12xx
-- 在 Supabase SQL Editor 中运行一次

do $$
declare
  pair record;
  keep_id uuid;
  drop_id uuid;
begin
  for pair in
    select
      c11.id as keep_id,
      c11.code as keep_code,
      c12.id as drop_id,
      c12.code as drop_code
    from public.courses c11
    join public.courses c12
      on lower(trim(c11.name_en)) = lower(trim(c12.name_en))
     and c11.code ~ '^PED11[0-9]{2}$'
     and c12.code ~ '^PED12[0-9]{2}$'
  loop
    keep_id := pair.keep_id;
    drop_id := pair.drop_id;

    -- 合并开设学期
    update public.courses c11
    set
      offered_terms = (
        select coalesce(array_agg(distinct t order by t), '{}'::text[])
        from (
          select unnest(coalesce(c11.offered_terms, '{}'::text[])) as t
          union
          select unnest(coalesce(c12.offered_terms, '{}'::text[])) as t
          from public.courses c12
          where c12.id = drop_id
        ) u
      ),
      updated_at = now()
    where c11.id = keep_id;

    -- 评价：同用户保留 keep 上的，其余改挂到 keep
    delete from public.reviews r_drop
    using public.reviews r_keep
    where r_drop.course_id = drop_id
      and r_keep.course_id = keep_id
      and r_drop.user_id = r_keep.user_id;

    update public.reviews
    set course_id = keep_id
    where course_id = drop_id;

    if to_regclass('public.discussion_posts') is not null then
      update public.discussion_posts
      set course_id = keep_id
      where course_id = drop_id;
    end if;

    if to_regclass('public.professor_recommendations') is not null then
      update public.professor_recommendations
      set course_id = keep_id
      where course_id = drop_id;
    end if;

    if to_regclass('public.review_requests') is not null then
      update public.review_requests rr_drop
      set course_id = keep_id
      where course_id = drop_id
        and not exists (
          select 1
          from public.review_requests rr_keep
          where rr_keep.course_id = keep_id
            and rr_keep.user_id = rr_drop.user_id
        );

      delete from public.review_requests
      where course_id = drop_id;
    end if;

    delete from public.courses
    where id = drop_id;

    raise notice 'deleted % (kept %)', pair.drop_code, pair.keep_code;
  end loop;
end $$;

do $$
declare
  cid uuid;
begin
  for cid in
    select id from public.courses where code ~ '^PED11[0-9]{2}$'
  loop
    perform public.refresh_course_stats(cid);
    if to_regprocedure('public.refresh_course_request_count(uuid)') is not null then
      perform public.refresh_course_request_count(cid);
    end if;
  end loop;
end $$;
