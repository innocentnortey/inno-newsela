"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { RadioCard, RadioGroup } from "@/components/ui/choice";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Textarea } from "@/components/ui/text-input";
import { ApiError, api, isApiError } from "@/lib/api-client";
import { useAnnounce } from "@/lib/announce";
import { useDraft } from "@/lib/draft-memory";
import {
  COLLAB_TEXT, DEPENDANTS_UNKNOWN_TEXT, MOVED_ON_TEXT, NOTE_REQUIRED_TEXT, REASON_REQUIRED_TEXT, STALE_TEXT,
  TAGS, TAG_REQUIRED_TEXT, buildReopen, buildRequestChanges, dependantsSentence, dialogTitle, reopenedToast,
  seesLine, sentBackToast, whoSeesIt, type SendBackTag,
} from "./copy";
import type { SendBackDialogProps } from "./send-back-dialog";
import { showToast } from "./toast-host";
import { readFreshLesson, useLessonContext } from "./use-lesson-context";

type FieldErrors = { tag?: string; note?: string; reason?: string };

export function SendBackForm(props: SendBackDialogProps) {
  const { lessonId, mode, pin } = props;
  const ctx = useLessonContext(lessonId);
  const announce = useAnnounce();
  const [tag, setTag, clearTag] = useDraft(`send-back:${lessonId}:tag`);
  const [note, setNote, clearNote] = useDraft(`send-back:${lessonId}:note`);
  const [reason, setReason, clearReason] = useDraft(`send-back:${lessonId}:reason`);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const errRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const firstRadioRef = useRef<HTMLInputElement | null>(null);
  const checkedRadioRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = setTimeout(
      () => (mode === "reopen" ? reasonRef.current : (checkedRadioRef.current ?? firstRadioRef.current))?.focus(),
      0,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (serverError) errRef.current?.focus();
  }, [serverError]);

  const clearDrafts = () => {
    clearTag();
    clearNote();
    clearReason();
  };
  const cancel = () => {
    if (inFlight.current) return;
    clearDrafts();
    props.onClose();
  };
  const handleStale = () => {
    clearDrafts();
    if (props.onStale) props.onStale();
    else showToast(STALE_TEXT);
    props.onClose();
  };
  const focusText = () => (mode === "reopen" ? reasonRef : noteRef).current?.focus();

  const handleError = (err: ApiError) => {
    switch (err.code) {
      case "NOTE_REQUIRED":
        setFieldErrors({ note: NOTE_REQUIRED_TEXT });
        setTimeout(focusText, 0);
        return;
      case "REASON_REQUIRED":
        setFieldErrors({ reason: REASON_REQUIRED_TEXT });
        setTimeout(focusText, 0);
        return;
      case "STALE_PIN":
        handleStale();
        return;
      case "INVALID_TRANSITION":
        clearDrafts();
        showToast(MOVED_ON_TEXT);
        props.onClose();
        return;
      case "COLLAB_UNAVAILABLE":
        setServerError(COLLAB_TEXT);
        return;
      default:
        setServerError(err.message);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setServerError(null);
    const errors: FieldErrors = {};
    if (mode === "request_changes") {
      if (tag === "") errors.tag = TAG_REQUIRED_TEXT;
      if (note.trim() === "") errors.note = NOTE_REQUIRED_TEXT;
    } else if (reason.trim() === "") errors.reason = REASON_REQUIRED_TEXT;
    setFieldErrors(errors);
    if (errors.tag || errors.note || errors.reason) {
      if (errors.tag) firstRadioRef.current?.focus();
      else focusText();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const fresh = await readFreshLesson(lessonId);
      if (fresh.snapshot?.content_hash !== pin.snapshotHash || fresh.snapshot?.state_vector !== pin.snapshotStateVector) {
        handleStale();
        return;
      }
      const body = mode === "reopen" ? buildReopen(reason, pin) : buildRequestChanges(tag as SendBackTag, note, pin);
      const { data: result } = await api.POST("/lessons/{lessonId}/transitions", { params: { path: { lessonId } }, body });
      const versionNumber = result!.version.version_number;
      const text = mode === "reopen" ? reopenedToast(lessonId, versionNumber) : sentBackToast(whoSeesIt(fresh));
      announce(text);
      showToast(text);
      clearDrafts();
      props.onDone?.({ kind: mode === "reopen" ? "reopened" : "sent_back", versionNumber });
      props.onClose();
    } catch (err) {
      handleError(
        isApiError(err) ? err : new ApiError({ status: 0, code: "NETWORK", message: "Couldn't reach Lesson Studio. Try again." }),
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const dependants =
    ctx.state === "ready" && ctx.lesson
      ? [...new Set(ctx.lesson.dependencies.filter((d) => d.direction === "depended_on_by").map((d) => d.lesson_id))]
      : [];

  return (
    <DialogShell
      open
      title={dialogTitle(mode, lessonId)}
      size="md"
      busy={submitting}
      onOpenChange={(o) => !o && cancel()}
      footer={
        <>
          <Button variant="secondary" onClick={cancel}>Cancel</Button>
          <Button variant="primary" type="submit" form="send-back-form" loading={submitting}>
            {mode === "reopen" ? "Reopen" : "Send back"}
          </Button>
        </>
      }
    >
      <form id="send-back-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div ref={errRef} tabIndex={-1} className="outline-none">
          {serverError ? <Banner level="blocking" title={serverError} /> : null}
        </div>
        {mode === "request_changes" ? (
          <>
            <div className="flex flex-col gap-1">
              <RadioGroup legend="Reason" required>
                {TAGS.map((t, i) => (
                  <RadioCard
                    key={t.value}
                    name="tag"
                    value={t.value}
                    label={t.label}
                    checked={tag === t.value}
                    aria-describedby={fieldErrors.tag ? "tag-error" : undefined}
                    onChange={() => setTag(t.value)}
                    ref={(el) => {
                      if (t.value === tag) checkedRadioRef.current = el;
                      if (i === 0) firstRadioRef.current = el;
                    }}
                  />
                ))}
              </RadioGroup>
              {fieldErrors.tag ? (
                <p id="tag-error" role="alert" className="text-small text-danger">{fieldErrors.tag}</p>
              ) : null}
            </div>
            <Textarea
              ref={noteRef}
              label="Note"
              help="Required. Say what needs to change."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              error={fieldErrors.note}
              rows={4}
              autoComplete="off"
            />
            <p className="text-small text-ink2">{seesLine(whoSeesIt(ctx.lesson))}</p>
          </>
        ) : (
          <>
            {dependants.length > 0 ? <Banner level="advisory" title={dependantsSentence(dependants, lessonId)} /> : null}
            {ctx.state === "failed" ? <Banner level="advisory" title={DEPENDANTS_UNKNOWN_TEXT} /> : null}
            <Textarea
              ref={reasonRef}
              label="Reason"
              help="Required. This is recorded in the lesson's history."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={fieldErrors.reason}
              rows={4}
              autoComplete="off"
            />
          </>
        )}
      </form>
    </DialogShell>
  );
}
