import Link from "next/link";

export default function CourseNotFound() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-purple-900">课程不存在</h1>
      <p className="mt-3 text-gray-600">
        没有找到这门课，可能尚未导入课程数据。
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-purple-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-purple-800"
      >
        返回首页
      </Link>
    </div>
  );
}
