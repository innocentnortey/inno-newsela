"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";

export interface FixEditorProps {
  label: string;
  initial: string;
  /** The server's sentence for INVALID_CHOICE, shown verbatim. */
  serverError: string | null;
  onSave(value: string): Promise<boolean>;
  onCancel(): void;
}

export function FixEditor({ label, initial, serverError, onSave, onCancel }: FixEditorProps) {
  const [value, setValue] = useState(initial);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  const check = () => {
    const bad = value.trim() === "";
    setLocalError(bad ? "Enter a code, or Cancel." : null);
    return !bad;
  };
  const save = async () => {
    if (!check()) return;
    setSaving(true);
    const ok = await onSave(value.trim());
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <div className="flex flex-col gap-2" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <TextInput
        ref={ref}
        label={label}
        value={value}
        error={localError ?? serverError ?? undefined}
        onChange={(e) => setValue(e.target.value)}
        onBlur={check}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="primary" loading={saving} onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
