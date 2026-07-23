# 修读计划爬取方案（Phase 2 扩展）

数据来源：香港中文大学（深圳）教务处 https://registry.cuhk.edu.cn

## 目标

从官网抓取各**本科专业**的修读计划 PDF，解析出：

- 专业名称（中/英）
- 所属学院/联办单位
- 课程代码列表（如 CSC3001、AIE1003）
- 适用入学年份

## 爬取入口

1. **专业索引**：http://registry.cuhk.edu.cn/page/20  
   列出全部本科专业及所属学院。

2. **各专业详情页**：如  
   - http://registry.cuhk.edu.cn/page/289（材料科学与工程）  
   - http://registry.cuhk.edu.cn/page/233（生物科学）  
   页面底部「文件下载」区含 Study Scheme PDF 链接。

3. **总览 PDF**（可选）：http://registry.cuhk.edu.cn/page/19  
   按入学年份提供完整本科学术课程 PDF。

## 建议实现步骤

1. 用 Node.js + `cheerio` 抓取 page/20，得到专业名称与各详情页 URL。
2. 逐个详情页抓取 PDF 下载链接（`sites/default/files/...Study Scheme...pdf`）。
3. 用 `pdf-parse` 从 PDF 文本中提取课程代码（正则：`/[A-Z]{2,4}\d{4}[A-Z]?/g`）。
4. 去重后写入 `data/courses.json`，并标注 `school` 与 `major`。
5. **人工抽检** 10% 条目，PDF 解析难免有误。

## 注意事项

- 遵守官网 robots.txt，请求间隔 ≥ 1 秒，避免高频访问。
- 数据仅作选课参考，以教务处最新 PDF 为准。
- 金融工程（FE）在官网归类为「经管+理工+数据科学联办」，爬取时单独标记 `school: "FE"`。
- 公共政策学院（SPP）为研究生学院，本科课程库可不纳入。
