"use client";

export type Source = "file" | "link";

const OPTIONS: { value: Source; label: string }[] = [
  { value: "file", label: "File" },
  { value: "link", label: "Sheet link" },
];

export function SourceSwitch({ value, onChange, disabled }: { value: Source; onChange(v: Source): void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="m-0 border-0 p-0">
      <legend className="sr-only">Outline source</legend>
      <div className="bg-well inline-flex rounded-md p-0.5">
        {OPTIONS.map((o) => (
          <label key={o.value} className="text-body text-ink cursor-pointer">
            <input
              type="radio"
              name="source"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="peer-checked:bg-panel peer-checked:shadow-e1 peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-offset-2 inline-flex h-8 items-center rounded-sm px-3 font-semibold">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
