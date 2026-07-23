# 港中深课程评价 (CUHK-SZ Course Review)

面向港中深学生的课程评价与选课指南平台。

## 本地运行（Phase 0）

1. 打开终端，进入项目文件夹：
   ```bash
   cd c:\Users\17610\Desktop\cuhk-sz-course-review
   ```
2. 启动开发服务器：
   ```bash
   npm run dev
   ```
3. 浏览器打开 [http://localhost:3000](http://localhost:3000)

## 目录说明

```
cuhk-sz-course-review/
├── app/                 # 页面（Next.js App Router）
│   ├── layout.tsx       # 全站布局（Header + Footer）
│   ├── page.tsx         # 首页
│   └── globals.css      # 全局样式
├── components/          # 可复用 UI 组件
│   └── layout/          # 布局组件
├── lib/                 # 工具函数与常量
├── types/               # TypeScript 类型定义
├── data/                # 课程样本数据
├── scripts/             # 后续数据导入脚本
├── supabase/            # 数据库 SQL（Phase 1）
│   ├── schema.sql       # 建表 + 触发器 + RLS
│   ├── seed-test.sql    # 测试数据
│   └── verify.sql       # 验证脚本
└── .env.example         # 环境变量模板
```

## Phase 1：Supabase 数据库（当前步骤）

### 1. 注册并创建项目

1. 打开 https://supabase.com ，用 GitHub 或邮箱注册
2. 点击 **New project**
3. 填写：
   - **Name**：`cuhk-sz-course-review`
   - **Database Password**：自己设一个强密码（保存好）
   - **Region**：选 **Southeast Asia (Singapore)**（离深圳最近）
4. 点击 **Create new project**，等待约 2 分钟

### 2. 运行建表 SQL

1. 左侧菜单 → **SQL Editor** → **New query**
2. 打开本项目 `supabase/schema.sql`，全选复制
3. 粘贴到 Supabase SQL Editor，点击 **Run**
4. 应看到 `Success. No rows returned`

### 3. 插入测试数据（可选）

1. 在 SQL Editor 新建 query
2. 复制 `supabase/seed-test.sql` 内容并 **Run**
3. 左侧 **Table Editor** → `courses` 表，应看到 5 条课程

### 4. 配置 Auth（邮箱 OTP）

1. 左侧 **Authentication** → **Providers** → **Email**
2. 确保 **Enable Email provider** 已开启
3. 开启 **Confirm email**（可选，MVP 建议先开）
4. **Authentication** → **URL Configuration**：
   - Site URL：`http://localhost:3000`
   - Redirect URLs 添加：`http://localhost:3000/**`

> 登录界面和数据库 RLS 均限制为 `@link.cuhk.edu.cn` 邮箱。

### 5. 复制 API 密钥到 `.env.local`

1. 左侧 **Project Settings**（齿轮）→ **API**
2. 复制 **Project URL** → 填入 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL`
3. 复制 **anon public** → 填入 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 复制 **service_role**（保密！）→ 填入 `SUPABASE_SERVICE_ROLE_KEY`

### 6. 验证 Phase 1

在 SQL Editor 运行 `supabase/verify.sql`，应返回 `courses`、`reviews`、`reports` 三张表。

## Phase 2：从教务处开课 PDF 导入课程

SIS 零信任网关会阻止浏览器自动化，因此课程数据改用官方
Pre-registration Course Offering Information PDF。当前数据覆盖
AY2025-26 Term 2 与 AY2026-27 Term 1。

### 1. 增加数据库字段

在 Supabase SQL Editor 运行：

```text
supabase/phase2-course-source.sql
```

### 2. 从 PDF 提取课程

```powershell
cd c:\Users\17610\Desktop\cuhk-sz-course-review
npm run extract:courses
```

脚本按 PDF 表格坐标提取课程代码、英文名、学院和学期。默认读取本机已提供的
两份 PDF；也可以按“PDF 路径 + 学期”成对传入自定义文件。原始结果保存在
`data/pdf-courses.raw.json`，不会提交到 Git。

### 3. 清洗与检查

```powershell
npm run normalize:courses
```

检查终端中的总课程数和学院统计。同一课程跨学期会按课程代码合并，并将开课
学期保存到 `offered_terms`。标题发生变化的课程记录在
`data/pdf-title-conflicts.json`，默认采用较新学期标题。

### 4. 预览并导入

```powershell
# 只查看新增/更新统计，不写数据库
npm run import:courses

# 确认统计合理后正式写入
npm run import:courses -- --apply
```

导入按课程代码 upsert，不会改变课程 UUID、既有评价和评分统计，也不会自动删除
本次 PDF 中未出现的旧课程。

## Phase 8：部署前配置

1. 在 Supabase SQL Editor 运行 `supabase/phase8-auth-hardening.sql`
2. 将项目推送到 GitHub，并在 Vercel 导入该仓库
3. 在 Vercel 配置以下环境变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. 部署成功后，在 Supabase Authentication → URL Configuration：
   - Site URL 改为 Vercel 正式地址
   - Redirect URLs 保留 `http://localhost:3000/**`
   - 再添加 `https://你的域名/**`

> `SUPABASE_SERVICE_ROLE_KEY` 仅供本地数据导入脚本使用，不需要配置到 Vercel。

---

## 开发阶段

- [x] Phase 0：项目初始化
- [x] Phase 1：Supabase 数据库
- [ ] Phase 2：课程数据导入（含教务处修读计划爬取）
- [x] Phase 3：Supabase 客户端
- [x] Phase 4：首页搜索与榜单
- [x] Phase 5：课程详情页
- [x] Phase 6：校内邮箱 OTP 登录
- [x] Phase 7：写评价、修改、删除与举报
- [ ] Phase 8：部署 ← 当前阶段
