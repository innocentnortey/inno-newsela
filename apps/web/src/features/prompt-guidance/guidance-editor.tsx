"use client";

import { useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Textarea, TextInput } from "@/components/ui/text-input";
import { useDraft } from "@/lib/draft-memory";
import { charsLeft, COPY } from "./copy";
import { latestText } from "./diff";
import type { GuidanceVersion, SaveProblem } from "./use-guidance";

const MAX = 8000;

export function GuidanceEditor({
  versions,
  saving,
  problem,
  message,
  onSave,
}: {
  versions: GuidanceVersion[];
  saving: boolean;
  problem: SaveProblem;
  message: string | null;
  onSave: (text: string, reason: string) => Promise<boolean>;
}) {
  const [draft, setDraft, clearDraft] = useDraft("guidance");
  const [reason, setReason, clearReason] = useDraft("reason");
  const [edited, setEdited] = useState(draft !== "");
  const text = edited ? draft : latestText(versions);

  async function submit() {
    if (await onSave(text, reason)) {
      clearDraft();
      clearReason();
      setEdited(false);
    }
  }

  return (
    <section aria-labelledby="pg-edit" className="flex flex-col gap-3">
      <h2 id="pg-edit" className="text-ink text-lg font-semibold">
        New version
      </h2>
      {problem?.kind === "stale" ? (
        <Banner level="blocking" title={COPY.staleBanner} />
      ) : null}
      {problem?.kind === "failed" ? (
        <Banner level="blocking" title={COPY.saveFailed} />
      ) : null}
      <Textarea
        label={COPY.guidanceLabel}
        rows={8}
        maxLength={MAX}
        placeholder={COPY.guidancePlaceholder}
        help={charsLeft(MAX - text.length)}
        value={text}
        onChange={(e) => {
          setEdited(true);
          setDraft(e.target.value);
        }}
      />
      <TextInput
        label={COPY.reasonLabel}
        value={reason}
        error={problem?.kind === "reason" ? COPY.reasonRequired : undefined}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex flex-col items-start gap-2">
        <Button loading={saving} onClick={() => void submit()}>
          {saving ? COPY.saving : COPY.save}
        </Button>
        <div role="status" className="text-body text-ink">
          {message}
        </div>
      </div>
    </section>
  );
}
