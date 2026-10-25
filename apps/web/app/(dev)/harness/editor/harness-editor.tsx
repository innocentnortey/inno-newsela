"use client";
// Dev-only harness for the NL-63 e2e tests (404 in production, see page.tsx).
import { useEffect, useState, useSyncExternalStore } from "react";
import { collab_url } from "@/editor/collab-url";
import { LessonEditor } from "@/editor/lesson-editor";
import type { EditorClientReport } from "@/editor/lesson-editor";
import { AnnounceProvider } from "@/lib/announce";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { start_seed } from "./seed";

const USERS = {
  okafor: { user_id: "u-okafor", name: "M. Okafor" },
  rivera: { user_id: "u-rivera", name: "J. Rivera" },
} as const;

declare global {
  interface Window {
    __editor_reports?: EditorClientReport[];
  }
}

/** Test-only: drops incoming `mode` messages so the editor stays editable after /__mock/lock. */
let held = false;
function hold_mode_messages(): void {
  if (held) return;
  held = true;
  const Native = window.WebSocket;
  const wrapped = new WeakMap<object, EventListener>();
  class Holding extends Native {
    override addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
      if (type !== "message") return super.addEventListener(type, listener, options);
      const call = (ev: Event) => (typeof listener === "function" ? listener.call(this, ev) : listener.handleEvent(ev));
      const hold: EventListener = (ev) => {
        const data = (ev as MessageEvent).data as unknown;
        if (data instanceof ArrayBuffer && new TextDecoder().decode(new Uint8Array(data)).includes('"type":"mode"')) return;
        call(ev);
      };
      wrapped.set(listener, hold);
      super.addEventListener(type, hold, options);
    }
    override removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
      super.removeEventListener(type, (type === "message" ? wrapped.get(listener) : undefined) ?? listener, options);
    }
  }
  window.WebSocket = Holding;
}

export function HarnessEditor(props: { doc: string; as: string; role: string; ro: boolean; seed: boolean; holdMode: boolean }) {
  // Mounted flag without an effect; the WebSocket wrapper must exist before LessonEditor's effects open sockets.
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (ready && props.holdMode) hold_mode_messages();
  const [report, setReport] = useState<EditorClientReport | null>(null);
  const user = props.as === "rivera" ? USERS.rivera : USERS.okafor;
  const role: Role = props.role === "approver" || props.role === "author" ? props.role : "reviewer";

  useEffect(() => {
    const stop = props.seed ? start_seed(collab_url(), props.doc) : undefined;
    return () => stop?.();
  }, [props.doc, props.seed]);

  const lesson = { lesson_id: props.doc, number: 4, title: "The Lightning Thief, Chapter 1" } as components["schemas"]["Lesson"];

  return (
    <AnnounceProvider>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        {ready ? (
          <LessonEditor
            lessonId={props.doc}
            lesson={lesson}
            readOnly={props.ro}
            viewer={{ ...user, role }}
            onClientState={(r) => {
              (window.__editor_reports ??= []).push(r);
              setReport(r);
            }}
          />
        ) : null}
        <aside aria-label="Evidence">
          <button type="button">Rail action</button>
        </aside>
        <output data-testid="client-report">{report ? report.state : ""}</output>
      </main>
    </AnnounceProvider>
  );
}
