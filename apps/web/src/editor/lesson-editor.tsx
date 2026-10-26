"use client";
// SCR-9 live editor: one Y.Doc per lesson (CON-12), one ProseMirror view per section. The only document state is the Y.Doc;
// React state holds section addresses and names, never text.
import type { EditorView } from "prosemirror-view";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore, type Ref } from "react";
import { createPortal } from "react-dom";
import type * as Y from "yjs";
import { useAnnounce } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import { can, type Role } from "@/lib/roles";
import { DisconnectedBanner, RefusedNotice, SignedOutNotice, refused_reason_phrase } from "@/features/workspace/live/notices";
import { InTopBar } from "@/features/frame/top-bar-slot";
import { PresenceSentence } from "@/features/workspace/live/presence-sentence";
import { save_state_text } from "@/features/workspace/live/save-state";
import type { EditorClientState, StoredAck } from "./client-state";
import { CollabSession, type SessionSnapshot } from "./collab-session";
import { collab_url } from "./collab-url";
import { create_late_key_capture, type LateKeyCapture } from "./late-keys";
import { initials_of, presence_entries, slot_of, type PresenceEntry } from "./presence";
import type { AssistSelection } from "@/features/assist/use-suggestions";
import { selectionAnchor } from "./selection-anchor";
import { SectionEditor } from "./section-editor";
import { Toolbar } from "./toolbar";

export type { EditorClientState } from "./client-state";

export interface EditorClientReport { state: EditorClientState; state_vector: string | null; stored: StoredAck | null }
export interface LessonEditorHandle {
  focus_section(address: string): void;
  /** NL-116: the current selection as an AI-assist anchor, or null when there is none the server could resolve. */
  getSelection(): AssistSelection | null;
}

export interface LessonEditorProps {
  lessonId: string;
  lesson: components["schemas"]["Lesson"];
  readOnly: boolean;
  onClientState: (r: EditorClientReport) => void;
  /** Who is typing and in which role. Without it the editor shows "Reviewer" and skips the role check. */
  viewer?: { user_id: string; name: string; role: Role };
  onPresence?: (entries: PresenceEntry[]) => void;
  /** SCR-9 (look sheet M3): the page sheet's toolbar strip. `undefined`: render above the text; `null`: the strip is
   * not mounted yet, render nothing. */
  toolbarHost?: HTMLElement | null;
  ref?: Ref<LessonEditorHandle>;
}

interface SectionInfo { address: string; name: string }

const EMPTY: SessionSnapshot = {
  state: "connecting",
  state_vector: null,
  stored: null,
  read_only: false,
  refusal: null,
  signed_out: false,
  mode_state: null,
};
const noop = () => () => {};
const NO_SECTIONS: SectionInfo[] = [];

function read_sections(doc: Y.Doc): SectionInfo[] {
  const order = doc.getArray<string>("section_order").toArray();
  const meta = doc.getMap<{ name?: string }>("section_meta");
  return order.map((address) => ({ address, name: meta.get(address)?.name ?? address }));
}

export function LessonEditor(props: LessonEditorProps) {
  const { lessonId, lesson, readOnly, viewer, onClientState, onPresence, toolbarHost, ref } = props;
  const announce = useAnnounce();
  const [session, setSession] = useState<CollabSession | null>(null);
  const identity = useRef({ viewer, readOnly });
  useEffect(() => {
    identity.current = { viewer, readOnly };
  });

  const role_forbids = viewer !== undefined && !can(viewer.role, "edit_lesson");
  const prop_read_only = readOnly || role_forbids;

  useEffect(() => {
    const v = identity.current.viewer ?? { user_id: "anonymous", name: "Reviewer" };
    const s = new CollabSession({
      url: collab_url(),
      lesson_id: lessonId,
      user: { user_id: v.user_id, name: v.name, initials: initials_of(v.name), slot: slot_of(v.user_id) },
      read_only: identity.current.readOnly,
    });
    setSession(s);
    return () => {
      s.destroy();
      setSession(null);
    };
  }, [lessonId]);

  useEffect(() => {
    session?.set_read_only(prop_read_only);
  }, [session, prop_read_only]);

  const subscribe = useMemo(() => (session ? (l: () => void) => session.subscribe(l) : noop), [session]);
  const get = useCallback(() => session?.snapshot() ?? EMPTY, [session]);
  const snap = useSyncExternalStore(subscribe, get, () => EMPTY);
  const doc = session?.doc ?? null;

  const [connecting_ms, setConnectingMs] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setConnectingMs(1000), 1000);
    return () => clearTimeout(t);
  }, []);

  // Sections: addresses and names only, derived from the Yjs doc.
  const sections_store = useMemo(() => {
    const state = { sections: doc ? read_sections(doc) : ([] as SectionInfo[]) };
    return {
      get: () => state.sections,
      subscribe: (cb: () => void) => {
        if (!doc) return () => {};
        const order = doc.getArray<string>("section_order");
        const meta = doc.getMap("section_meta");
        const update = () => {
          state.sections = read_sections(doc);
          cb();
        };
        update();
        order.observe(update);
        meta.observeDeep(update);
        return () => {
          order.unobserve(update);
          meta.unobserveDeep(update);
        };
      },
    };
  }, [doc]);
  const sections = useSyncExternalStore(sections_store.subscribe, sections_store.get, () => NO_SECTIONS);

  // Presence.
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const names = useMemo(() => new Map(sections.map((s) => [s.address, s.name])), [sections]);
  const names_ref = useRef(names);
  const presence_cb = useRef(onPresence);
  useEffect(() => {
    names_ref.current = names;
    presence_cb.current = onPresence;
  });
  useEffect(() => {
    if (!session || !doc) return;
    const aw = session.awareness;
    const update = () => {
      const next = presence_entries(aw.getStates(), aw.clientID, names_ref.current);
      setEntries(next);
      presence_cb.current?.(next);
    };
    update();
    aw.on("change", update);
    return () => aw.off("change", update);
  }, [session, doc, names]);

  // Views and toolbar.
  const [views] = useState(() => new Map<string, EditorView>());
  const [active, setActive] = useState<EditorView | null>(null);
  const [tick, setTick] = useState(0);
  const register = useCallback((address: string, view: EditorView | null) => {
    if (view) {
      views.set(address, view);
      setActive((a) => a ?? view);
    } else {
      const old = views.get(address);
      views.delete(address);
      setActive((a) => (a === old ? (views.values().next().value ?? null) : a));
    }
  }, [views]);
  const active_ref = useRef(active);
  useEffect(() => {
    active_ref.current = active;
  });
  useImperativeHandle(
    ref,
    () => ({
      focus_section: (address: string) => views.get(address)?.focus(),
      // The last focused section first, then any other with a non-empty selection.
      getSelection: () => {
        const order = [active_ref.current, ...views.values()].filter((v): v is EditorView => v !== null);
        for (const v of order) {
          if (v.state.selection.empty) continue;
          return selectionAnchor(v);
        }
        return null;
      },
    }),
    [views],
  );

  const state = snap.state;
  const read_only = prop_read_only || snap.read_only;
  const root_ref = useRef<HTMLDivElement>(null);
  const read_only_ref = useRef(false);
  const capture = useRef<LateKeyCapture | null>(null);
  useEffect(() => {
    read_only_ref.current = read_only;
  });
  useEffect(() => {
    if (!session || !root_ref.current) return;
    const c = create_late_key_capture({
      root: root_ref.current,
      doc: document,
      is_editable: () => !read_only_ref.current,
      on_text: (s) => session.add_late_text(s),
    });
    capture.current = c;
    return () => {
      c.dispose();
      capture.current = null;
    };
  }, [session]);
  const was_read_only = useRef(read_only);
  useEffect(() => {
    if (!was_read_only.current && read_only) capture.current?.arm();
    else if (!read_only) capture.current?.disarm();
    was_read_only.current = read_only;
  }, [read_only]);
  const stored_at = snap.stored?.stored_at ?? null;
  const text = save_state_text(state, stored_at, connecting_ms);

  useEffect(() => {
    if (state === "stored" || state === "saving" || state === "DISCONNECTED" || state === "read_only") {
      announce(save_state_text(state, stored_at, 1000));
    }
    // announce on state changes only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const report_cb = useRef(onClientState);
  useEffect(() => {
    report_cb.current = onClientState;
  });
  useEffect(() => {
    if (snap.signed_out) report_cb.current({ state: "DISCONNECTED", state_vector: null, stored: null });
    else report_cb.current({ state, state_vector: snap.state_vector, stored: snap.stored });
  }, [state, snap.state_vector, snap.stored, snap.signed_out]);

  // Callers may pass a partial lesson (the editor harness has no sections); minutes are then simply not shown.
  const minutes_of = (address: string): number | null => (lesson.sections ?? []).find((x) => x.address === address)?.minutes ?? null;
  const lesson_label = lesson.number !== null && lesson.number !== undefined ? `Lesson ${lesson.number}` : (lesson.title ?? "Lesson");
  const sign_in_href = () =>
    `/sign-in?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname + window.location.search)}`;

  return (
    <div ref={root_ref} data-testid="lesson-editor" data-lesson-id={lessonId} data-client-state={state} className="flex flex-col gap-3">
      {/* Presence and the save state belong in the top bar (SCR-9); outside the app frame they render here. */}
      <InTopBar>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 truncate max-sm:hidden">
            <PresenceSentence entries={entries} />
          </div>
          <span data-testid="save-state" data-state={state} data-stored-at={stored_at ?? ""} className="text-small text-ink2">
            {text}
          </span>
        </div>
      </InTopBar>
      {state === "DISCONNECTED" && !snap.signed_out ? <DisconnectedBanner /> : null}
      {snap.refusal ? (
        <RefusedNotice lesson_label={lesson_label} reason_phrase={refused_reason_phrase(snap.mode_state)} removed_text={snap.refusal.text} />
      ) : null}
      {snap.signed_out ? <SignedOutNotice signInHref={sign_in_href()} /> : null}
      {!snap.signed_out && !read_only && active
        ? toolbarHost
          ? createPortal(<Toolbar view={active} tick={tick} />, toolbarHost)
          : toolbarHost === undefined
            ? <Toolbar view={active} tick={tick} />
            : null
        : null}
      {!snap.signed_out ? (
        <div role="group" aria-label={`${lesson_label} text`} className="flex flex-col">
          {sections.length === 0 && state === "connecting" ? (
            <p className="text-small text-ink2" aria-busy="true">
              Opening the lesson…
            </p>
          ) : null}
          {doc
            ? sections.map((s) => (
                <div key={`${doc.guid}:${s.address}`} id={`sec-${s.address}`} data-address={s.address} className="mt-6 flex flex-col first:mt-0">
                  {/* Look sheet M3: one flowing document; each section opens with a label row (name · minutes) over a hairline. */}
                  <h3 className="text-label text-ink3 border-hair mb-2 flex justify-between gap-3 border-b pb-1.5 font-semibold">
                    <span>{s.name}</span>
                    {minutes_of(s.address) ? <span className="tabular-nums whitespace-nowrap">{`${minutes_of(s.address)} min`}</span> : null}
                  </h3>
                  <SectionEditor
                    address={s.address}
                    label={`${lesson_label} text · ${s.name}`}
                    fragment={doc.getXmlFragment(`section:${s.address}`)}
                    awareness={session!.awareness}
                    editable={!read_only}
                    onFocus={setActive}
                    onTransaction={() => setTick((t) => t + 1)}
                    register={register}
                  />
                </div>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
