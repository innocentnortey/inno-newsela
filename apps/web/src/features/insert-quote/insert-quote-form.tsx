"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Select } from "@/components/ui/select";
import { Textarea, TextInput } from "@/components/ui/text-input";
import { useWorkspaceToast } from "@/features/workspace/actions/toast-host";
import { useLesson } from "@/features/workspace/use-lesson";
import { api } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { useDraft } from "@/lib/draft-memory";
import { mapFillError, type FillFailure } from "./fill-errors";
import { findSlot } from "./find-slot";
import { RIGHTS_OPTIONS, type OfferedRights } from "./rights";
import { SHORT_QUOTE_LIMIT, countWords } from "./word-count";

type FillSlotRequest = components["schemas"]["FillSlotRequest"];
const FROZEN = ["submitted", "approved", "exported"];

export interface InsertQuoteFormProps {
  lessonId: string;
  slotId: string;
  onClose: () => void;
  onFilled?: () => void;
}

export function InsertQuoteForm({ lessonId, slotId, onClose, onFilled }: InsertQuoteFormProps) {
  const { load, retry } = useLesson(lessonId);
  const toast = useWorkspaceToast();
  const announce = useAnnounce();
  const slot = load.kind === "ready" ? findSlot(load.lesson.sections, slotId) : null;
  const frozen = load.kind === "ready" && FROZEN.includes(load.lesson.state);
  const [text, setText, clearText] = useDraft(`insert-quote:${slotId}:text`);
  const [title, setTitle, clearTitle] = useDraft(`insert-quote:${slotId}:title`);
  const [chapter, setChapter, clearChapter] = useDraft(`insert-quote:${slotId}:chapter`);
  const [pages, setPages, clearPages] = useDraft(`insert-quote:${slotId}:pages`);
  const [url, setUrl, clearUrl] = useDraft(`insert-quote:${slotId}:url`);
  const [rights, setRights] = useState<OfferedRights>("short-quote-commentary");
  const rightsTouched = useRef(false);
  const [failure, setFailure] = useState<FillFailure | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const [opener] = useState(() => (typeof document === "undefined" ? null : document.activeElement));

  const slotRights = slot?.rights;
  useEffect(() => {
    if (slotRights && !rightsTouched.current) setRights(slotRights);
  }, [slotRights]);

  const ready = !!slot && !frozen;
  useEffect(() => {
    if (!ready) return;
    // Radix focuses the header Close first; this runs after it.
    const t = setTimeout(() => textRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      setTimeout(() => {
        if (!document.querySelector("[role=dialog]") && opener instanceof HTMLElement) opener.focus();
      }, 0);
    },
    [opener],
  );

  const words = countWords(text);
  const over = rights === "short-quote-commentary" && words > SHORT_QUOTE_LIMIT;
  const wasOver = useRef(false);
  useEffect(() => {
    if (over && !wasOver.current) announce(`${words} of ${SHORT_QUOTE_LIMIT} words: over the limit for a short quote.`);
    wasOver.current = over;
  }, [over, words, announce]);

  function finish() {
    clearText();
    clearTitle();
    clearChapter();
    clearPages();
    clearUrl();
    onClose();
  }

  useEffect(() => {
    if (failure?.target === "banner") bannerRef.current?.focus();
    else if (failure?.target === "text") textRef.current?.focus();
    else if (failure?.target === "source") titleRef.current?.focus();
  }, [failure]);

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (submitting || !slot || frozen) return;
    setFailure(null);
    const body: FillSlotRequest = {
      text,
      source_ref: {
        title,
        chapter: chapter === "" ? null : chapter,
        pages: pages === "" ? null : pages,
        ...(slot.kind === "excerpt" && url !== "" ? { url } : {}),
      },
      rights_status: rights,
    };
    setSubmitting(true);
    try {
      const { data } = await api.POST("/lessons/{lessonId}/slots/{slotId}/fill", { params: { path: { lessonId, slotId } }, body });
      toast.show({
        message: data?.still_blocking || rights === "to-clear" ? "Inserted. Still blocking: rights to clear." : "Quote inserted. Issue 1 resolved.",
      });
      onFilled?.();
      finish();
    } catch (e) {
      setFailure(mapFillError(e, words));
    } finally {
      if (alive.current) setSubmitting(false);
    }
  }

  const title_ = slot ? (slot.kind === "excerpt" ? "Fill excerpt slot" : "Insert quote") : "Insert quote or excerpt";
  const rightsHelp = RIGHTS_OPTIONS.find((o) => o.value === rights)?.help;
  const missing = load.kind === "not_found" || load.kind === "schema_unknown" || (load.kind === "ready" && !slot);

  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && finish()}
      size="lg"
      busy={submitting}
      eyebrow={slot?.address}
      title={title_}
      footer={
        <>
          <Button variant="secondary" onClick={finish}>
            Cancel
          </Button>
          {frozen ? null : (
            <Button
              type="submit"
              form="insert-quote-form"
              loading={submitting}
              disabled={load.kind === "loading"}
              disabledReason={load.kind === "loading" ? "Still loading the slot." : undefined}
            >
              Insert
            </Button>
          )}
        </>
      }
    >
      <form id="insert-quote-form" onSubmit={onSubmit} noValidate>
        <div className="flex flex-col gap-5">
          {failure?.target === "banner" ? (
            <div ref={bannerRef} tabIndex={-1} className="rounded-lg outline-offset-2">
              <Banner level="blocking" title={failure.message} />
            </div>
          ) : null}
          {frozen ? <Banner level="blocking" title="This lesson is locked. Withdraw it first to insert a quote." /> : null}
          {load.kind === "error" ? (
            <Banner
              level="blocking"
              title="Couldn't load this slot. Try again."
              action={
                <Button variant="ghost" size="sm" onClick={retry}>
                  Retry
                </Button>
              }
            />
          ) : null}
          {missing ? <Banner level="blocking" title="This slot is no longer in the lesson." /> : null}
          {ready && slot ? (
            <>
              <div className="bg-well text-body text-ink rounded-lg p-3">{slot.ask}</div>
              <Textarea
                ref={textRef}
                label="Text"
                rows={5}
                value={text}
                onChange={(e) => setText(e.target.value)}
                help={rights === "short-quote-commentary" ? `${words} of ${SHORT_QUOTE_LIMIT} words` : undefined}
                error={failure?.target === "text" ? failure.message : undefined}
              />
              <fieldset className="flex flex-col gap-3">
                <legend className="text-small text-ink font-semibold">Source</legend>
                <TextInput
                  ref={titleRef}
                  label="Book or title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoComplete="off"
                  error={failure?.target === "source" ? failure.message : undefined}
                />
                <TextInput label="Chapter" value={chapter} onChange={(e) => setChapter(e.target.value)} autoComplete="off" />
                <TextInput label="Page or pages" value={pages} onChange={(e) => setPages(e.target.value)} autoComplete="off" />
                {slot.kind === "excerpt" ? (
                  <TextInput
                    label="URL"
                    type="url"
                    help="Use this when the excerpt comes from a web page."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    autoComplete="off"
                  />
                ) : null}
              </fieldset>
              <Select
                label="Rights status"
                options={RIGHTS_OPTIONS}
                help={rightsHelp}
                value={rights}
                onChange={(e) => {
                  rightsTouched.current = true;
                  setRights(e.target.value as OfferedRights);
                }}
              />
            </>
          ) : null}
        </div>
      </form>
    </DialogShell>
  );
}
