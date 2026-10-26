"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { TextInput } from "@/components/ui/text-input";
import { useAnnounce } from "@/lib/announce";
import { api } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import { DropZone } from "./drop-zone";
import { LINK_IMPORT_ENABLED } from "./flags";
import { MSG_EXT, reportHref, sameHashLine, successLine, toUploadError, type UploadError } from "./messages";
import { SourceSwitch, type Source } from "./source-switch";
import { useProgressStage } from "./use-progress-stage";

type OutlineVersion = components["schemas"]["OutlineVersion"];

const SUCCESS_DWELL_MS = 1500;

async function uploadFile(file: File): Promise<OutlineVersion> {
  const { data } = await api.POST("/outline-versions", {
    body: { file: file as unknown as string },
    bodySerializer: () => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    },
  });
  return data!;
}

async function importLink(url: string): Promise<OutlineVersion> {
  const { data } = await api.POST("/outline-versions/import", { body: { sheet_url: url.trim() } });
  return data!;
}

export function UploadForm() {
  const router = useRouter();
  const announce = useAnnounce();
  const [source, setSource] = useState<Source>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [result, setResult] = useState<OutlineVersion | null>(null);
  const stage = useProgressStage(busy);
  const errorRef = useRef<HTMLDivElement>(null);
  const zoneRef = useRef<HTMLButtonElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (!result) return;
    if (result.same_as_version === null) {
      announce(successLine(result));
      const t = setTimeout(() => router.push(reportHref(result)), SUCCESS_DWELL_MS);
      return () => clearTimeout(t);
    }
    announce(sameHashLine(result));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function switchTo(next: Source) {
    if (busy) return;
    setSource(next);
    setError(null);
    setFieldError(null);
  }

  function reject() {
    setError({ code: "UNSUPPORTED_FILE", text: MSG_EXT, retry: false });
    announce(MSG_EXT);
  }

  async function submit() {
    if (busy || result) return;
    if (source === "file" && !file) {
      if (error?.code === "UNSUPPORTED_FILE") {
        // The type banner already says what is wrong; do not add "Choose a file first." beside it (F-12).
        zoneRef.current?.focus();
        return;
      }
      setError(null);
      setFieldError("Choose a file first.");
      zoneRef.current?.focus();
      return;
    }
    if (source === "link" && !url.trim()) {
      setFieldError("Paste the sheet's link first.");
      urlRef.current?.focus();
      return;
    }
    setError(null);
    setFieldError(null);
    setBusy(true);
    try {
      setResult(await (source === "file" ? uploadFile(file!) : importLink(url)));
    } catch (e) {
      const u = toUploadError(e);
      setError(u);
      announce(u.text);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    void submit();
  }

  const same = result !== null && result.same_as_version !== null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {LINK_IMPORT_ENABLED ? <SourceSwitch value={source} onChange={switchTo} disabled={busy} /> : null}
      {source === "file" || !LINK_IMPORT_ENABLED ? (
        <DropZone
          ref={zoneRef}
          file={file}
          disabled={busy}
          onFile={(f) => {
            setFile(f);
            setError(null);
            setFieldError(null);
          }}
          onReject={reject}
          error={fieldError ?? undefined}
        />
      ) : (
        <TextInput
          ref={urlRef}
          label="Google Sheet link"
          type="url"
          inputMode="url"
          name="sheet_url"
          help="The sheet must be shared so anyone with the link can view it."
          autoComplete="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={fieldError ?? undefined}
        />
      )}
      <p role="status" className="text-small text-ink2">
        {busy ? (stage === 1 ? "Reading rows…" : stage === 2 ? "Reading rows · Checking codes" : "") : ""}
      </p>
      {error ? (
        <div ref={errorRef} tabIndex={-1} data-testid="upload-error" className="rounded-lg outline-none focus-visible:outline-2">
          <Banner
            level="blocking"
            title={error.text}
            action={
              error.retry ? (
                <Button variant="secondary" size="sm" onClick={() => void submit()}>
                  Retry
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : null}
      {result ? (
        same ? (
          <Banner level="info" title={sameHashLine(result)} action={<Link href={reportHref(result)}>Open the report</Link>} />
        ) : (
          <Banner level="success" title={successLine(result)} />
        )
      ) : null}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={busy}
        disabled={!!result}
        disabledReason={result ? `Version ${result.version_number} is saved` : undefined}
      >
        {source === "file" || !LINK_IMPORT_ENABLED ? "Upload" : "Import"}
      </Button>
    </form>
  );
}
