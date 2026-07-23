-- Phase 7：允许用户读取自己发表的评价（含被举报隐藏后），便于编辑/查看状态
-- 在 Supabase SQL Editor 中运行一次

drop policy if exists "reviews_read_own" on public.reviews;
create policy "reviews_read_own"
on public.reviews for select
to authenticated
using (auth.uid() = user_id);

-- 用户只能删除自己发表的评价
drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own"
on public.reviews for delete
to authenticated
using (auth.uid() = user_id);
