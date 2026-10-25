"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAnnounce } from "@/lib/announce";
import { COPY } from "./copy";

export function CopyHashButton({
  hash,
  describedBy,
}: {
  hash: string;
  describedBy?: string;
}) {
  const announce = useAnnounce();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(hash);
    } catch {
      return;
    }
    announce(COPY.copied);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        aria-describedby={describedBy}
        onClick={() => void onClick()}
      >
        {COPY.copyHash}
      </Button>
      {copied ? (
        <span aria-hidden="true" className="text-small text-ink2">
          {COPY.copied}
        </span>
      ) : null}
    </span>
  );
}
