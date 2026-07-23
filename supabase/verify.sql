-- Phase 1 验证脚本：在 SQL Editor 中运行，检查表是否创建成功

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('courses', 'reviews', 'reports')
order by table_name;

-- 手动插入一条测试课程（验证写入权限：需用 service role 或在 Phase 2 脚本里写）
-- insert into public.courses (code, name_cn, name_en, school)
-- values ('CSC3001', '离散数学', 'Discrete Mathematics', 'SSE');

-- 查看课程
select * from public.courses limit 5;
