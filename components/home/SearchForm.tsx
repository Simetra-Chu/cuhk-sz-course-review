import { Search } from "lucide-react";
import type { SchoolCode } from "@/lib/constants";

type SearchFormProps = {
  defaultQuery?: string;
  school?: SchoolCode;
};

export function SearchForm({ defaultQuery, school }: SearchFormProps) {
  return (
    <form action="/" method="get" className="mt-3">
      {school && <input type="hidden" name="school" value={school} />}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          id="search"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          placeholder="输入课程代码或名称，例如 CSC3001、离散数学"
          className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-24 outline-none ring-purple-200 focus:ring-2"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-purple-700 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-purple-800"
        >
          搜索
        </button>
      </div>
    </form>
  );
}
