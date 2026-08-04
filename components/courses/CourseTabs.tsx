"use client";

import { useState, type ReactNode } from "react";

type ExtraTabId = "professors" | "prerequisites";

type CourseTabsProps = {
  reviewCount: number;
  discussionCount: number;
  recommendationCount: number;
  reviews: ReactNode;
  discussions: ReactNode;
  professors: ReactNode;
  prerequisites: ReactNode;
  feed: ReactNode;
};

const EXTRA_TABS: Array<{ id: ExtraTabId; label: string }> = [
  { id: "professors", label: "推荐教授" },
  { id: "prerequisites", label: "先修" },
];

export function CourseTabs({
  reviewCount,
  discussionCount,
  recommendationCount,
  reviews,
  discussions,
  professors,
  prerequisites,
  feed,
}: CourseTabsProps) {
  const [extraTab, setExtraTab] = useState<ExtraTabId>("professors");

  function extraLabel(item: (typeof EXTRA_TABS)[number]) {
    if (item.id === "professors") {
      return `${item.label} (${recommendationCount})`;
    }
    return item.label;
  }

  return (
    <section className="mt-8 space-y-10">
      <div id="course-comments">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-purple-950">评论区</h2>
          <p className="text-sm text-gray-500">{discussionCount} 条评论</p>
        </div>
        {discussions}
      </div>

      <div id="course-reviews">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-purple-950">评价区</h2>
          <p className="text-sm text-gray-500">{reviewCount} 条评价</p>
        </div>
        {reviews}
      </div>

      <div>
        <div
          role="tablist"
          aria-label="更多课程信息"
          className="flex flex-wrap gap-2 border-b border-purple-100 pb-3"
        >
          {EXTRA_TABS.map((item) => {
            const active = extraTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setExtraTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-purple-700 text-white"
                    : "bg-white text-purple-800 ring-1 ring-purple-200 hover:bg-purple-50"
                }`}
              >
                {extraLabel(item)}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="mt-6">
          {extraTab === "professors" ? professors : prerequisites}
        </div>
      </div>

      {feed}
    </section>
  );
}
