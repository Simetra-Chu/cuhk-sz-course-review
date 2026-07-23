/**
 * 港中深学院/培养单位列表（与教务处官网一致）
 * - FE 为金融工程本科专业（经管+理工+数据科学三院联办），单独作为筛选维度
 * - 不含 LHS（不存在）；公共政策学院 SPP 为研究生学院，本科选课平台暂不纳入
 */
export const SCHOOLS = [
  { code: "SSE", name: "理工学院" },
  { code: "SME", name: "经管学院" },
  { code: "SDS", name: "数据科学学院" },
  { code: "HSS", name: "人文社科学院" },
  { code: "MED", name: "医学院" },
  { code: "MUS", name: "音乐学院" },
  { code: "SAI", name: "人工智能学院" },
  { code: "FE", name: "金融工程（三院联办）" },
] as const;

export type SchoolCode = (typeof SCHOOLS)[number]["code"];

export const ALLOWED_EMAIL_DOMAIN = "@link.cuhk.edu.cn";

/** 高分榜：至少几条评价才计入 */
export const MIN_REVIEWS_FOR_LEADERBOARD = 3;

/** 榜单与搜索结果默认条数 */
export const LEADERBOARD_LIMIT = 10;

/** 评价可选标签 */
export const REVIEW_TAGS = [
  "给分慷慨",
  "给分严格",
  "作业适中",
  "作业量大",
  "推荐",
  "避雷",
  "签到少",
  "点名频繁",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];

/** 评价正文最少字数（与数据库 check 一致） */
export const MIN_REVIEW_CONTENT_LENGTH = 16;

/** 教务处「本科专业」索引页 */
export const REGISTRY_MAJORS_URL = "http://registry.cuhk.edu.cn/page/20";

/** 教务处「本科学术课程 / 修读计划总览」页 */
export const REGISTRY_CURRICULUM_URL = "http://registry.cuhk.edu.cn/page/19";
