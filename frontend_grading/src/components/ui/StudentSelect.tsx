import React from "react";

type Option = {
  value: string;
  label: React.ReactNode; // lets you pass JSX (name + badge + score)
};

type SimpleSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
};

export default function StudentSelect({
  value,
  onChange,
  options,
  className,
}: SimpleSelectProps) {
  return (
    <select
      className={`w-full rounded-md border px-4 py-2 text-sm bg-white ${className ?? ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {/* plain text only here */}
          {typeof opt.label === "string" ? opt.label : ""}
        </option>
      ))}
    </select>
  );
}
