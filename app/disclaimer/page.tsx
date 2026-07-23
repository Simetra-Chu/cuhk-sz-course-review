import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "免责声明与隐私说明 | 港中深课程评价",
};

const sections = [
  {
    title: "非官方声明",
    content:
      "本站由学生自发建设，与香港中文大学（深圳）及其教务处、学院无隶属或授权关系，本站内容不代表学校立场。",
  },
  {
    title: "信息仅供参考",
    content:
      "课程信息和学生评价可能存在遗漏、延迟或错误，仅供选课参考，不构成正式选课建议。课程安排、要求及名额请以教务处和 SIS 的最新信息为准。",
  },
  {
    title: "用户内容",
    content:
      "评价由用户自行发布。请基于真实修读体验理性表达，不得发布人身攻击、歧视、违法内容或他人隐私。平台有权隐藏或删除明显违规内容。",
  },
  {
    title: "隐私说明",
    content:
      "校内邮箱仅用于验证学生身份和维护登录状态，不会在评价页面公开展示。评价默认匿名展示，但平台不会承诺对依法提出的有效请求保持绝对匿名。",
  },
  {
    title: "举报机制",
    content:
      "登录用户可以举报不当评价。达到系统设定的举报阈值后，评价会自动隐藏；自动隐藏不等同于平台已认定内容违法或失实。",
  },
];

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-purple-700 transition hover:text-purple-900"
      >
        <ArrowLeft className="h-4 w-4" />
        返回首页
      </Link>

      <article className="mt-6 rounded-3xl border border-purple-100 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-purple-950 sm:text-3xl">
          免责声明与隐私说明
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          使用本站即表示你理解并接受以下说明。
        </p>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="font-semibold text-purple-900">{section.title}</h2>
              <p className="mt-2 text-sm leading-7 text-gray-700">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
