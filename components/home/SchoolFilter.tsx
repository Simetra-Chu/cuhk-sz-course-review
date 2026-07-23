import Link from "next/link";
import {
  SCHOOLS,
  type CourseTerm,
  type SchoolCode,
} from "@/lib/constants";
import { buildHomeQuery } from "@/lib/courses";
import { cn } from "@/lib/utils";

type SchoolFilterProps = {
  activeSchool?: SchoolCode;
  query?: string;
  term?: CourseTerm;
};

export function SchoolFilter({
  activeSchool,
  query,
  term,
}: SchoolFilterProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <Link
        href={buildHomeQuery({ q: query, term })}
        className={cn(
          "rounded-full border px-4 py-2 text-sm transition",
          !activeSchool
            ? "border-purple-700 bg-purple-700 text-white"
            : "border-purple-200 bg-white text-purple-900 hover:border-purple-400 hover:bg-purple-50"
        )}
      >
        全部
      </Link>

      {SCHOOLS.map((school) => {
        const isActive = activeSchool === school.code;

        return (
          <Link
            key={school.code}
            href={buildHomeQuery({
              q: query,
              school: school.code,
              term,
            })}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition",
              isActive
                ? "border-purple-700 bg-purple-700 text-white"
                : "border-purple-200 bg-white text-purple-900 hover:border-purple-400 hover:bg-purple-50"
            )}
          >
            {school.code} · {school.name}
          </Link>
        );
      })}
    </div>
  );
}
