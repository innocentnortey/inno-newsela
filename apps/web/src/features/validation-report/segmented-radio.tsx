"use client";

import { useId } from "react";

export interface SegmentedRadioProps {
  legend: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange(value: string): void;
}

export function SegmentedRadio({ legend, value, options, onChange }: SegmentedRadioProps) {
  const name = useId();
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="bg-well inline-flex flex-wrap gap-0.5 rounded-md p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className="text-small text-ink has-[:checked]:bg-selected has-[:checked]:border-primary has-[:focus-visible]:outline-primary flex min-h-7 cursor-pointer items-center rounded-sm border border-transparent px-2 has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1"
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
