"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { useAnnounce } from "@/lib/announce";
import { api, isApiError } from "@/lib/api-client";
import type { Role } from "@/lib/roles";
import { resolveLanding } from "./next-param";

const MSG_NOT_LISTED = "This email is not on the staff list. Check the spelling or ask your content lead to add you.";
const MSG_INVALID = "That email and password don't match.";
// The live region must not repeat the inline sentence verbatim: a text query (or a screen-reader user browsing by text) would find two copies (NL-90 real-stack finding).
const SAY_INVALID = "Sign-in failed. Check your email and password.";
const SAY_NOT_LISTED = "Sign-in failed. That email is not on the staff list.";
const MSG_NETWORK = "Couldn't reach Lesson Studio. Try again.";

export function SignInForm({ next, onSignedIn }: { next?: string | null; onSignedIn?: (role: Role) => void }) {
  const router = useRouter();
  const announce = useAnnounce();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    const form = new FormData(ev.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setEmailError(undefined);
    setPasswordError(undefined);
    setBusy(true);
    try {
      const { data } = await api.POST("/session", { body: { email, password } });
      const role = data!.user.role;
      onSignedIn?.(role);
      router.replace(resolveLanding(role, next));
    } catch (e) {
      const code = isApiError(e) ? e.code : "NETWORK";
      if (code === "INVALID_CREDENTIALS") {
        setPasswordError(MSG_INVALID);
        announce(SAY_INVALID);
        passwordRef.current?.focus();
      } else {
        const msg = code === "NOT_ON_ALLOW_LIST" ? MSG_NOT_LISTED : MSG_NETWORK;
        setEmailError(msg);
        announce(code === "NOT_ON_ALLOW_LIST" ? SAY_NOT_LISTED : msg);
        emailRef.current?.focus();
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextInput
        ref={emailRef}
        label="Staff email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        error={emailError}
      />
      <TextInput
        ref={passwordRef}
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        error={passwordError}
      />
      <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
        Sign in
      </Button>
    </form>
  );
}
