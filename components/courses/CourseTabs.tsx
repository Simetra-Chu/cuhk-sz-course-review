"use client";

import { useState, type ReactNode } from "react";

type TabId = "reviews" | "discussions" | "professors" | "prerequisites";

type CourseTabsProps = {
  reviewCount: number;
  discussionCount: number;
  recommendationCount: number;
  reviews: ReactNode;
  discussions: ReactNode;
  professors: ReactNode;
  prerequisites: ReactNode;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "reviews", label: "评价" },
  { id: "discussions", label: "讨论" },
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
}: CourseTabsProps) {
  const [tab, setTab] = useState<TabId>("reviews");

  function tabLabel(item: (typeof TABS)[number]) {
    if (item.id === "reviews") return `${item.label} (${reviewCount})`;
    if (item.id === "discussions") return `${item.label} (${discussionCount})`;
    if (item.id === "professors") {
      return `${item.label} (${recommendationCount})`;
    }
    return item.label;
  }

  return (
    <section className="mt-8">
      <div
        role="tablist"
        aria-label="课程详情分区"
        className="flex flex-wrap gap-2 border-b border-purple-100 pb-3"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-purple-700 text-white"
                  : "bg-white text-purple-800 ring-1 ring-purple-200 hover:bg-purple-50"
              }`}
            >
              {tabLabel(item)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === "reviews" && reviews}
        {tab === "discussions" && discussions}
        {tab === "professors" && professors}
        {tab === "prerequisites" && prerequisites}
      </div>
    </section>
  );
}
