import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-purple-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-gray-600">
        <p className="font-medium text-purple-900">港中深课程评价 · 非官方学生项目</p>
        <p className="mt-2">
          浏览无需登录；发表评价需使用 @link.cuhk.edu.cn 邮箱验证。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
          <p>课程信息仅供参考，以教务处官方数据为准。</p>
          <Link
            href="/feedback"
            className="text-purple-600 underline-offset-4 hover:underline"
          >
            用户反馈
          </Link>
          <Link
            href="/disclaimer"
            className="text-purple-600 underline-offset-4 hover:underline"
          >
            用户协议、免责声明与隐私说明
          </Link>
        </div>
      </div>
    </footer>
  );
}
