import type { LucideIcon } from "lucide-react";
import { CourseCard } from "@/components/courses/CourseCard";
import type { DbCourse } from "@/types/database";

type LeaderboardPanelProps = {
  title: string;
  icon: LucideIcon;
  courses: DbCourse[];
  emptyMessage: string;
  hint?: string;
  metric?: "reviews" | "requests";
};

export function LeaderboardPanel({
  title,
  icon: Icon,
  courses,
  emptyMessage,
  hint,
  metric,
}: LeaderboardPanelProps) {
  return (
    <div className="rounded-2xl border border-purple-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 text-purple-900">
        <Icon className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}

      {courses.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">{emptyMessage}</p>
      ) : (
        <div className="mt-4 divide-y divide-purple-50">
          {courses.map((course, index) => (
            <CourseCard
              key={course.id}
              course={course}
              rank={index + 1}
              compact
              metric={metric}
            />
          ))}
        </div>
      )}
    </div>
  );
}
