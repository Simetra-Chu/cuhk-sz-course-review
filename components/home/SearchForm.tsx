import { Search } from "lucide-react";
import {
  COURSE_TERMS,
  type CourseTerm,
  type SchoolCode,
} from "@/lib/constants";

type SearchFormProps = {
  defaultQuery?: string;
  school?: SchoolCode;
  term?: CourseTerm;
};

export function SearchForm({
  defaultQuery,
  school,
  term,
}: SearchFormProps) {
  return (
    <form action="/" method="get" className="mt-3">
      {school && <input type="hidden" name="school" value={school} />}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            id="search"
            name="q"
            type="search"
            defaultValue={defaultQuery}
            placeholder="输入课程代码或英文名称，例如 CSC3001"
            className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 outline-none ring-purple-200 focus:ring-2"
          />
        </div>
        <select
          name="term"
          defaultValue={term ?? ""}
          aria-label="开课学期"
          className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none ring-purple-200 focus:ring-2"
        >
          <option value="">全部学期</option>
          {COURSE_TERMS.map((courseTerm) => (
            <option key={courseTerm} value={courseTerm}>
              {courseTerm}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-purple-700 px-5 py-3 text-sm font-medium text-white transition hover:bg-purple-800"
        >
          搜索
        </button>
      </div>
    </form>
  );
}
