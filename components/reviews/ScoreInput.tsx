"use client";

type ScoreInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
};

export function ScoreInput({ label, value, onChange, hint }: ScoreInputProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-purple-900">{label}</p>
        <button
          type="button"
          onClick={() => onChange(0)}
          className="text-xs text-gray-500 underline-offset-2 hover:text-purple-700 hover:underline"
        >
          不评分
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(selected ? 0 : score)}
              className={`h-9 w-9 rounded-full text-sm font-medium transition ${
                selected
                  ? "bg-purple-700 text-white"
                  : "border border-purple-100 bg-white text-purple-800 hover:bg-purple-50"
              }`}
              aria-pressed={selected}
            >
              {score}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-gray-500">
        {value >= 1 ? `已选 ${value}/5` : "未评分（可选）"}
      </p>
    </div>
  );
}
