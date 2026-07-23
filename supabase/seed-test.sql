-- 可选：插入 5 条测试课程，用于 Phase 1 验证
-- 注意：courses 表没有开放 anon/authenticated 的 insert 策略，
-- 请在 Supabase SQL Editor（以 postgres 身份）中运行此脚本。

insert into public.courses (code, name_cn, name_en, school) values
  ('CSC3001', '离散数学', 'Discrete Mathematics', 'SSE'),
  ('ECO2011', '微观经济学', 'Microeconomics', 'SME'),
  ('STA2002', '概率统计', 'Probability and Statistics', 'SDS'),
  ('AIE1003', '人工智能导论', 'Introduction to Artificial Intelligence', 'SAI'),
  ('FIN3080', '金融衍生产品', 'Financial Derivatives', 'FE')
on conflict (code) do nothing;

select code, name_cn, school, review_count from public.courses order by code;
