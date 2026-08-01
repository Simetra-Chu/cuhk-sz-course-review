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
      <p className="text-sm font-medium text-purple-900">{label}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={`h-9 w-9 rounded-full border text-sm font-medium transition ${
              value === score
                ? "border-purple-700 bg-purple-700 text-white"
                : "border-purple-200 bg-white text-purple-800 hover:border-purple-400 hover:bg-purple-50"
            }`}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}
