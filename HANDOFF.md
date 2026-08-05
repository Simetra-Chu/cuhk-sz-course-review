# 项目交接总结（Handoff Summary）

> 面向下一位开发者 / AI 助手：读完本文应能直接接手 CUHK-SZ 课程评价项目，无需回溯全部聊天记录。  
> 最后更新：2026-08-04（基于近期对话与本地仓库状态）

---

## 1. 项目概述与架构

### 1.1 产品是什么

**港中深课程评价（CUHK-SZ Course Review）**：面向香港中文大学（深圳）学生的课程浏览、打分、评论、教授评价与求评价平台。

- **线上域名**：`https://www.cuhk-sz-course-review.xin`（阿里云域名 → Vercel）
- **仓库**：`https://github.com/Simetra-Chu/cuhk-sz-course-review`（默认分支 `main`）
- **登录**：仅 `@link.cuhk.edu.cn` 邮箱 OTP（Supabase Auth）
- **内容原则**：评价/评论匿名展示；UGC 需注意合规与版权

### 1.2 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Next.js 14（App Router）+ TypeScript + Tailwind CSS |
| 后端 | Next.js Server Components / Route Handlers + Supabase（Postgres + Auth + RLS） |
| 托管 | Vercel |
| 本地脚本 | `tsx` + Playwright + `@supabase/supabase-js`（service role 导入） |

### 1.3 核心产品分区（课程详情页）

课程页大致结构（自上而下）：

1. **课程头图信息**（代码、学院、均分、求评价按钮）
2. **评论区**（`discussion_posts`：文字讨论 / 回复 / 点赞）
3. **评价区**（`reviews`：**只打分 + 可选标签**，不再写长文）
4. **推荐教授 / 先修**（Tab）
5. **全部**（`CourseMixedFeed`：评价 + 评论按时间混排）

重要产品约定（近期敲定）：

- **打分 ≠ 评论**：可只打分、可只评论、可都做
- **飞书导入的教授相关内容**：只进「推荐教授」，**不进评论区**
- **正面 + 中性**教授评价保留；**完全负面**丢弃
- 教授评价正文前 **不要** 加 `【签到少·有考试】` 这类标签前缀

### 1.4 关键目录

```
app/                      # 页面（首页、课程详情、我的评价、反馈、免责声明、Auth callback）
components/
  courses/                # CourseTabs / DiscussionSection / CourseMixedFeed / 求评价 / 教授推荐 / 先修
  reviews/                # ReviewForm（打分）/ ReviewCard / ScoreInput
  home/                   # 榜单、目录、最新评价
lib/                      # auth / courses / reviews / supabase clients
scripts/                  # 课程导入、尼龙 Excel、飞书抓取/改写/导入
supabase/                 # schema.sql + 各 phase*.sql（需在 SQL Editor 手动执行）
data/                     # courses.json、feishu-scrapes/ 等
types/database.ts         # 与表结构对应的 TypeScript 类型
```

---

## 2. 最新改动与 SQL 结构

### 2.1 近期功能改动（代码侧）

| 主题 | 说明 |
|---|---|
| 评价 / 评论分离 | `ReviewForm` 仅评分+标签；文字走评论区 |
| 课程页布局 | 评论区在上、评价区在下；底部「全部」混排 |
| PED 去重 | 与 PED11xx 同名的 PED12xx 删除，保留 11xx；武术散打 = **PED1122** |
| 求评价 | 去掉重复的第二枚按钮；插入后 RPC 刷新 `request_count`；取消需确认 |
| 首页榜单 | `export const dynamic = "force-dynamic"`，避免缓存导致求评价榜不更新 |
| 尼龙朋友圈 Excel | `scripts/import-nylon-moments.ts` → 评论区 + 教授推荐 |
| 飞书 LGU 数据 | 抓取 → 同义改写 → **仅教授推荐**（见第 4 节） |
| 评论标签字段 | `discussion_posts.tags`（UI 已在混排评论中展示 chips） |

### 2.2 数据库：必须按序确认的 SQL 文件

权威全量结构：`supabase/schema.sql`（新环境可整份跑；已有环境用 phase 增量）。

近期 / 关键增量（生产库需确认是否已执行）：

| 文件 | 作用 |
|---|---|
| `phase8-dedupe-ped12.sql` | 合并删除 PED12xx 重名课 |
| `phase8-optional-review-scores.sql` | `reviews.rating/difficulty/grading` 可空；均分忽略 null |
| `phase8-optional-review-content.sql` | `reviews.content` 允许空（只打分） |
| `phase8-professor-rec-min-length.sql` | 教授推荐正文 ≥ **1** 字 |
| `phase8-fix-request-count.sql` | 重建求评价计数触发器 + **grant execute** + 回填 |
| `phase9-discussion-tags.sql` | `discussion_posts.tags text[]` + `valid_discussion_tags()` |

#### `phase9-discussion-tags.sql` 要点

- Postgres **CHECK 不能直接写子查询**，必须用 immutable 函数：
  - `public.valid_discussion_tags(p_tags text[])`
  - 约束：`check (public.valid_discussion_tags(tags))`
- 规则：最多 8 个标签；每个 trim 后长度 2–12
- 若曾报错 `cannot use subquery in check constraint`，用仓库里**已修好**的 phase9 重跑即可

#### `reviews` 相关约束（摘要）

- 评分三列可为 `NULL`，或 1–5
- `content` 默认 `''`；空或长度 > 15
- 前端校验：至少选一项评分才可提交打分

#### `review_requests` / `courses.request_count`

- 插入/删除请求后由触发器 `trg_review_requests_refresh_count` 更新
- 前端还会调用 RPC：`refresh_course_request_count(p_course_id)`
- 首页「求评价榜」：`request_count > 0` 排序

### 2.3 种子用户（导入脚本默认挂载）

- Email：`125020443@link.cuhk.edu.cn`
- `user_id`：`20feb4f8-023f-43db-8ae1-d31cba672dbc`
- 相关脚本均写死该 ID（改账号时需同步改脚本）

### 2.4 Git / 工作区注意

- 远程 `main` 上已有部分近期提交（求评价修复、布局等）
- **大量本地改动尚未全部 push**（含飞书脚本、`phase9-discussion-tags.sql`、混排/标签 UI 等）
- 临时文件勿提交：`_excel_dump.json`、`_ped_dump.json`、`.env.local`、`data/feishu-scrapes/` 视情况

---

## 3. 开发环境与生产环境隔离

### 3.1 现状（请接手时先核实）

当前仓库**尚未在代码层强制**「双 Supabase 项目」；常见实际用法是：

| 环境 | 前端 | 后端数据 |
|---|---|---|
| 本地 | `npm run dev` → localhost:3000 | `.env.local` 指向某一 Supabase 项目 |
| 生产 | Vercel Production（`main`） | Vercel 环境变量中的 Supabase URL/Anon Key |
| Auth | Supabase Auth Site URL / Redirect | 需包含 `https://www.cuhk-sz-course-review.xin` 与本地 URL |

脚本导入（尼龙 / 飞书）使用 **`SUPABASE_SERVICE_ROLE_KEY`**，只应出现在本地 `.env.local`，**不要**配进 Vercel 前端环境。

### 3.2 建议约定（Dev / Prod 隔离）

接手后建议明确落地（若尚未拆库）：

1. **Supabase**
   - **Production**：线上真实用户与课程数据
   - **Development**：本地与 Preview 联调；可跑危险 SQL / 批量导入试验
2. **Git + Vercel**
   - `main` → Production Deployment
   - feature 分支 → Vercel **Preview**；Preview 环境变量指向 **Dev Supabase**
3. **SQL 执行纪律**
   - 新 `phase*.sql` 先在 Dev 验证，再在 Prod SQL Editor 执行
   - 批量导入脚本默认连 Dev；对 Prod 需显式确认
4. **Auth URL**
   - Prod：www / apex 域名
   - Dev/Preview：localhost + `*.vercel.app` Preview URL

> 若目前本地 `.env.local` 与 Vercel 指向同一 Supabase：批量飞书导入、去重 SQL 都会直接影响线上，操作前务必确认。

---

## 4. 当前未完成 / 调试中的任务

### 4.1 飞书「卡园 LGU」数据管线（进行中）

目标数据源（分享视图，内容可见）：

`https://blankspace.feishu.cn/share/base/view/shrcnctnLSH9AJM4DCkEYaOC1ue`

**政策（用户敲定）**：

1. 原文做**少量同义改写**，保留口语（降低照搬风险，但**非法律免责**）
2. **只写入教授推荐**（`professor_recommendations`）
3. **正面 + 中性**保留；**完全负面**丢弃
4. **不进评论区**
5. 正文前**不要** `【标签】` 前缀（库内样例已剥离）

相关脚本：

| 脚本 | 作用 |
|---|---|
| `scripts/scrape-feishu-base-view.ts` | Playwright 滚动抓表格视图（启发式解析，完整度待加强） |
| `scripts/scrape-feishu-reviews.ts` | 旧方案：查询页按课程码搜索（法律风险更高，慎用） |
| `scripts/transform-feishu-reviews.ts` | 同义改写 + 情感分流 + 输出 transformed JSON |
| `scripts/import-feishu-transformed.ts` | 导入 transformed（现以教授推荐为主） |
| `scripts/reimport-feishu-professor-only.ts` | 清理误入评论并按新规则重导样例 |

样例课（已用于验证）：**ACT2111 / ENG1001 / ACT3154**

### 4.2 前端标签展示（半完成）

- `discussion_posts.tags` + `CourseMixedFeed` chips：**已做**
- 评论发表表单（`DiscussionSection`）**尚未**提供用户自选/自填标签 UI
- 教授推荐区**没有**独立 tags 字段；标签曾塞进正文前缀，现已取消

### 4.3 整表自动化导入（未完成）

- 视图抓取对虚拟列表不稳定，**全量抓取质量未达标**
- 课程代码映射不完整（如残缺码、空格码、CEC2001→GEA2000 等特例）
- 同课同教授合并策略、重复导入幂等，需在全量前再测

### 4.4 其它遗留

- 尼龙 Excel 导入产生的评论仍带历史痕迹（已清理 nylon 标记）；与飞书策略不同（尼龙进过评论区）
- 工作区大量 uncommitted 变更，需整理后 push，避免「本地有、线上无」
- 求评价：Prod 需确认已跑 `phase8-fix-request-count.sql`

---

## 5. 下一阶段开发待办清单（TodoList）

接手后建议按此优先级推进：

### P0 — 环境与仓库对齐

1. **确认 Dev / Prod Supabase 是否已拆分**；统一文档与 `.env` 约定；核对 Vercel Production / Preview 环境变量。  
2. **梳理并提交**本地未 push 的关键改动（至少：`phase9-discussion-tags.sql`、飞书脚本、课程页混排/标签 UI、教授推荐文案），避免线上落后。  
3. **核对 Prod SQL**：phase8 系列 + phase9 是否已执行；抽查 ACT2111 `request_count` 与求评价榜。

### P1 — 飞书数据正式导入

4. **加强 `scrape-feishu-base-view.ts`**（或导出 CSV 人工落盘）：拿到稳定全量 JSON。  
5. **跑通** `transform` → 人工抽查改写质量与负面过滤 → `import`（默认连 Dev，确认后再 Prod）。  
6. 补全 **课程代码映射表**（残缺代码、别名、体育课 PED11xx）。

### P2 — 产品打磨

7. 评论区：**发表评论时支持标签**（与 `discussion_posts.tags` 对齐），或明确「仅机器打标、用户不可编辑」。  
8. 教授专栏文案/能力是否改名为更贴切的「教授评价」（含中性），避免「推荐」语义过窄。  
9. 合规：免责声明是否需补充「第三方整理内容经改写仅供参考」类说明（产品/法务决定）。

---

## 6. 常用命令速查

```powershell
cd C:\Users\17610\Desktop\cuhk-sz-course-review

npm run dev

# 课程目录导入
npm run import:courses -- --apply

# 尼龙朋友圈
npx tsx scripts/import-nylon-moments.ts
npx tsx scripts/import-nylon-moments.ts --apply

# 飞书视图抓取 / 改写 / 导入
npx tsx scripts/scrape-feishu-base-view.ts --max-scrolls 80
npx tsx scripts/transform-feishu-reviews.ts data/feishu-scrapes/sample-manual.json
npx tsx scripts/import-feishu-transformed.ts
npx tsx scripts/import-feishu-transformed.ts --apply

# 样例：清评论、只留教授评价
npx tsx scripts/reimport-feishu-professor-only.ts --apply
```

---

## 7. 给下一位 AI 助手的最短指令

1. 先读本文 + `supabase/schema.sql` + `types/database.ts`。  
2. 改库只用 `supabase/phase*.sql` 增量，注意 **CHECK 子查询陷阱用函数包装**。  
3. 课程页：**评论 ≠ 打分 ≠ 教授评价** 三套表，不要混写。  
4. 飞书数据：**只写 `professor_recommendations`**，过滤完全负面，正文不加 `【标签】`。  
5. 批量写入前确认连的是 Dev 还是 Prod；`SUPABASE_SERVICE_ROLE_KEY` 永不提交、不进 Vercel 前端。  
6. 用户偏好：给可复制的 PowerShell/`git` 命令；**不要擅自 push**，除非用户明确说 push。

---

*本文由交接对话生成，写入仓库根目录 `HANDOFF.md`。若与线上实际情况冲突，以 Supabase 控制台表结构与 Vercel 环境变量为准，并回写更新本文。*
