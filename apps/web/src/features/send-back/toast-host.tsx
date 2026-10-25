"use client";
import { createRoot, type Root } from "react-dom/client";
import { Toast, ToastRegion } from "@/components/ui/toast";

// Own React root on document.body so the toast outlives the dialog (and the host screen's unmount of it).
let current: { root: Root; el: HTMLElement } | null = null;

function teardown(c: { root: Root; el: HTMLElement }) {
  c.root.unmount();
  c.el.remove();
  if (current?.el === c.el) current = null;
}

export function showToast(message: string, durationMs = 6000): void {
  if (typeof document === "undefined") return;
  if (current) teardown(current);
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  const mine = { root, el };
  current = mine;
  const dismiss = () => queueMicrotask(() => { if (el.isConnected) teardown(mine); });
  root.render(
    <ToastRegion>
      <Toast message={message} durationMs={durationMs} onDismiss={dismiss} />
    </ToastRegion>,
  );
}
