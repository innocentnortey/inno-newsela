"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// SCR-9 (look sheet M3): presence and the save state sit in the top bar. The top bar owns an empty slot; a screen
// portals its status into it. With no slot mounted (unit tests, or a screen outside the frame) the status renders in place.
interface Ctx {
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
}
const TopBarSlotContext = createContext<Ctx>({ slot: null, setSlot: () => {} });

export function TopBarSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return <TopBarSlotContext.Provider value={{ slot, setSlot }}>{children}</TopBarSlotContext.Provider>;
}

export function TopBarSlotHost() {
  const { setSlot } = useContext(TopBarSlotContext);
  return <div ref={setSlot} data-slot="top-bar-status" className="flex min-w-0 items-center gap-4 overflow-hidden whitespace-nowrap" />;
}

export function InTopBar({ children }: { children: ReactNode }) {
  const { slot } = useContext(TopBarSlotContext);
  return slot ? createPortal(children, slot) : <>{children}</>;
}
