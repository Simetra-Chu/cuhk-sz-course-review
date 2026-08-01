import Link from "next/link";

type PrerequisitesPanelProps = {
  courseCode: string;
  prerequisite: string | null;
  corequisite: string | null;
  exclusion: string | null;
};

const COURSE_CODE_PATTERN = /\b[A-Z]{2,5}\d{4}[A-Z]?\b/g;

function RequirementText({ value }: { value: string }) {
  const parts: Array<{ type: "text" | "code"; value: string }> = [];
  let lastIndex = 0;
  const pattern = new RegExp(COURSE_CODE_PATTERN.source, "g");
  let match: RegExpExecArray | null = pattern.exec(value);

  while (match) {
    const index = match.index;
    if (index > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, index) });
    }
    parts.push({ type: "code", value: match[0] });
    lastIndex = index + match[0].length;
    match = pattern.exec(value);
  }
  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }

  if (parts.length === 0) {
    return <>{value}</>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.type === "code" ? (
          <Link
            key={`${part.value}-${index}`}
            href={`/course/${part.value}`}
            className="font-mono text-purple-700 underline-offset-2 hover:underline"
          >
            {part.value}
          </Link>
        ) : (
          <span key={`t-${index}`}>{part.value}</span>
        )
      )}
    </>
  );
}

export function PrerequisitesPanel({
  courseCode,
  prerequisite,
  corequisite,
  exclusion,
}: PrerequisitesPanelProps) {
  const hasAny = Boolean(prerequisite || corequisite || exclusion);

  return (
    <div className="rounded-2xl border border-purple-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-purple-900">先修要求</h2>
      <p className="mt-1 font-mono text-sm text-gray-500">{courseCode}</p>

      {hasAny ? (
        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-purple-900">先修（Prerequisite）</dt>
            <dd className="mt-1 leading-7 text-gray-800">
              {prerequisite ? (
                <RequirementText value={prerequisite} />
              ) : (
                <span className="text-gray-400">无 / 未标注</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-purple-900">同修（Corequisite）</dt>
            <dd className="mt-1 leading-7 text-gray-800">
              {corequisite ? (
                <RequirementText value={corequisite} />
              ) : (
                <span className="text-gray-400">无 / 未标注</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-purple-900">互斥（Exclusion）</dt>
            <dd className="mt-1 leading-7 text-gray-800">
              {exclusion ? (
                <RequirementText value={exclusion} />
              ) : (
                <span className="text-gray-400">无 / 未标注</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 text-sm text-gray-600">
          开课文件中未标注该课的先修 / 同修 / 互斥信息。请以 SIS 最新通知为准。
        </p>
      )}

      <p className="mt-5 text-xs text-gray-500">
        数据来自教务处开课 PDF，可能存在解析误差或后续变更。
      </p>
    </div>
  );
}
