"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Choice = "light" | "dark" | "system";

export function ThemeSwitch() {
  const [active, setActive] = useState<Choice>("system");
  function choose(t: Choice) {
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
    setActive(t);
  }
  return (
    <div role="group" aria-label="Theme" className="flex gap-2 p-2">
      {(["light", "dark", "system"] as const).map((t) => (
        <Button key={t} variant="secondary" size="sm" aria-pressed={active === t} onClick={() => choose(t)}>
          {t === "light" ? "Light" : t === "dark" ? "Dark" : "System"}
        </Button>
      ))}
    </div>
  );
}
