-- Phase 8：上线前加固写入权限
-- 在 Supabase SQL Editor 中运行一次

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
