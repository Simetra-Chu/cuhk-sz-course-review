import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "用户协议、免责声明与隐私说明 | 港中深课程评价",
};

const sections = [
  {
    title: "非官方声明",
    paragraphs: [
      "本站是由学生自发建设的非官方课程评价项目，与香港中文大学（深圳）及其教务处、学院不存在隶属、授权、代理或合作关系。本站名称仅用于说明服务对象，任何内容均不代表学校立场。",
    ],
  },
  {
    title: "服务与账号",
    paragraphs: [
      "任何人可以浏览公开课程信息；发表、修改、删除评价、推荐教授或提交举报时，需要使用 @link.cuhk.edu.cn 校内邮箱完成验证。",
      "用户应妥善保护邮箱和登录会话，不得冒用他人身份、转让账号或利用自动化工具批量注册、登录及提交内容。发现异常使用时，平台可以限制相关操作。",
    ],
  },
  {
    title: "内容发布规范",
    paragraphs: [
      "评价应尽量基于真实修读经历，围绕课程内容、难度、工作量、考核和学习体验进行理性表达。用户对自己发布的文字、评分和标签负责。",
    ],
    bullets: [
      "不得发布违法违规、骚扰、仇恨、歧视、人身攻击、威胁或明显诽谤性内容；",
      "不得泄露教师、同学或其他人员的私人联系方式、身份凭证、成绩等非公开个人信息；",
      "不得发布广告、垃圾信息、与课程无关内容，或通过重复评价、恶意举报等方式操纵数据；",
      "不得上传试题、答案、课件等可能侵犯知识产权或违反课程规定的材料。",
    ],
  },
  {
    title: "内容管理与举报",
    paragraphs: [
      "为维护正常讨论环境，平台可以对疑似违规内容进行隐藏、删除或其他必要处理。达到系统设定的举报阈值后，评价可能自动隐藏；自动隐藏不表示平台已经认定相关内容违法或失实。",
      "用户可以删除自己的评价。对于恶意举报、绕过限制或持续破坏服务的行为，平台可以采取限制访问等措施。",
    ],
  },
  {
    title: "课程信息与评价免责声明",
    paragraphs: [
      "课程名称、开课学期及其他信息来源于公开或用户提供的教务资料，可能存在遗漏、延迟、解析误差或后续变更。课程安排、先修要求、名额、教师和考核方式应以教务处、学院及 SIS 的最新通知为准。",
      "评分、评价与教授推荐属于用户主观经验，仅供参考，不构成学校通知、正式选课建议或对教学质量的权威结论。本站不对推荐教授做票数汇总或官方排序。用户应结合自身培养方案和官方信息独立判断。",
    ],
  },
  {
    title: "隐私与数据使用",
    paragraphs: [
      "平台会处理完成服务所必需的数据，包括校内邮箱、认证用户标识、登录会话、用户主动提交的评价与举报，以及由 Supabase、Vercel 等基础服务提供商为安全和运行维护产生的必要技术记录。",
      "校内邮箱用于身份验证、安全控制和维护登录状态，不会在公开评价页面展示，也不会用于出售个人信息或发送商业广告。评价默认匿名展示，但匿名展示不等于技术上的绝对匿名。",
      "数据可能由提供认证、数据库和托管服务的基础设施供应商按照其隐私与安全规则处理。平台会采取合理措施保护数据，但互联网服务无法保证绝对安全。",
    ],
    bullets: [
      "公开展示：课程评分、标签、评价正文和发表时间；",
      "不公开展示：校内邮箱、认证用户标识及登录凭证；",
      "用户权利：可以在课程页面修改或删除自己的评价；如需处理账号或其他数据问题，可通过项目 GitHub 仓库反馈。",
    ],
  },
  {
    title: "责任限制",
    paragraphs: [
      "在适用法律允许的范围内，平台不对因依赖本站信息作出的选课决定、课程调整、数据暂时不可用或第三方服务故障造成的间接损失承担责任。平台不会免除依法不能排除或限制的责任。",
    ],
  },
  {
    title: "协议更新与联系",
    paragraphs: [
      "平台可能根据功能、数据处理方式或法律要求更新本说明，并在本页面标注更新日期。重大变化会尽量通过页面提示说明；更新后继续登录或使用相关功能，视为接受更新后的条款。",
    ],
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
          用户协议、免责声明与隐私说明
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          生效及最近更新日期：2026 年 7 月 23 日
        </p>
        <div className="mt-6 rounded-2xl bg-purple-50 p-4 text-sm leading-7 text-purple-950">
          请在登录和发布内容前认真阅读。勾选同意并继续登录，表示你已经阅读、
          理解并同意遵守本页面条款。
        </div>

        <div id="user-agreement" className="mt-8 scroll-mt-24 space-y-8">
          {sections.map((section, index) => (
            <section key={section.title}>
              <h2 className="font-semibold text-purple-900">{section.title}</h2>
              <div className="mt-2 space-y-2">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-sm leading-7 text-gray-700"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-gray-700">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {index === sections.length - 1 && (
                <p className="mt-3 text-sm leading-7 text-gray-700">
                  项目反馈：
                  <a
                    href="https://github.com/Simetra-Chu/cuhk-sz-course-review"
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 text-purple-700 underline underline-offset-2 hover:text-purple-900"
                  >
                    GitHub 仓库
                  </a>
                </p>
              )}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
