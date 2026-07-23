"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  COURSE_INITIALS,
  type CourseInitial,
} from "@/lib/constants";
import { getSubjectName } from "@/lib/course-subjects";
import type { CatalogCourse } from "@/lib/courses";
import { cn } from "@/lib/utils";

type CourseCatalogBrowserProps = {
  courses: CatalogCourse[];
};

export function CourseCatalogBrowser({
  courses,
}: CourseCatalogBrowserProps) {
  const [activeInitial, setActiveInitial] = useState<CourseInitial>("A");
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set()
  );

  const groupedCourses = useMemo(() => {
    const groups = new Map<string, CatalogCourse[]>();

    courses.forEach((course) => {
      const subject = course.subject_code?.toUpperCase();
      if (!subject || !subject.startsWith(activeInitial)) return;
      const group = groups.get(subject) ?? [];
      group.push(course);
      groups.set(subject, group);
    });

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [activeInitial, courses]);

  const availableInitials = useMemo(
    () =>
      new Set(
        courses
          .map((course) => course.subject_code?.charAt(0).toUpperCase())
          .filter(Boolean)
      ),
    [courses]
  );

  function selectInitial(initial: CourseInitial) {
    setActiveInitial(initial);
    setExpandedSubjects(new Set());
  }

  function toggleSubject(subject: string) {
    setExpandedSubjects((current) => {
      const next = new Set(current);
      if (next.has(subject)) {
        next.delete(subject);
      } else {
        next.add(subject);
      }
      return next;
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-purple-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mx-auto max-w-3xl rounded-xl border border-purple-200 p-3">
        <div className="flex flex-wrap justify-center gap-1">
          {COURSE_INITIALS.map((initial) => {
            const hasCourses = availableInitials.has(initial);
            const isActive = activeInitial === initial;

            return (
              <button
                key={initial}
                type="button"
                onClick={() => selectInitial(initial)}
                disabled={!hasCourses}
                className={cn(
                  "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-purple-700 text-white shadow-sm"
                    : hasCourses
                      ? "text-purple-800 hover:bg-purple-100"
                      : "cursor-not-allowed text-gray-300"
                )}
                aria-pressed={isActive}
              >
                {initial}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setExpandedSubjects(new Set())}
          className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-800 transition hover:bg-purple-100"
        >
          全部收起
        </button>
        <button
          type="button"
          onClick={() =>
            setExpandedSubjects(
              new Set(groupedCourses.map(([subject]) => subject))
            )
          }
          className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-800 transition hover:bg-purple-100"
        >
          全部展开
        </button>
      </div>

      <p className="mt-5 text-sm text-gray-600">
        点击学科代码，展开或收起该学科的课程。
      </p>

      <div className="mt-4 space-y-2">
        {groupedCourses.map(([subject, subjectCourses]) => {
          const isExpanded = expandedSubjects.has(subject);

          return (
            <div
              key={subject}
              className="overflow-hidden rounded-xl border border-purple-100"
            >
              <button
                type="button"
                onClick={() => toggleSubject(subject)}
                className="flex w-full items-center gap-2 bg-white px-4 py-3 text-left font-semibold text-purple-900 transition hover:bg-purple-50"
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 shrink-0 text-purple-600" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-purple-600" />
                )}
                <span>
                  {subject} · {getSubjectName(subject)}
                </span>
                <span className="ml-auto text-xs font-normal text-gray-500">
                  {subjectCourses.length} 门
                </span>
              </button>

              {isExpanded && (
                <div className="overflow-x-auto border-t border-purple-100">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="bg-purple-50 text-purple-900">
                      <tr>
                        <th className="w-36 px-4 py-2 font-semibold">
                          课程编号
                        </th>
                        <th className="px-4 py-2 font-semibold">课程名称</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50">
                      {subjectCourses.map((course) => {
                        const courseNumber = course.code.slice(subject.length);
                        const title = course.name_en ?? course.name_cn;

                        return (
                          <tr key={course.id} className="hover:bg-purple-50/50">
                            <td className="px-4 py-2">
                              <Link
                                href={`/course/${course.code}`}
                                className="font-mono font-medium text-purple-700 underline-offset-2 hover:underline"
                              >
                                {courseNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-2">
                              <Link
                                href={`/course/${course.code}`}
                                className="text-purple-900 underline-offset-2 hover:text-purple-700 hover:underline"
                              >
                                {title}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
