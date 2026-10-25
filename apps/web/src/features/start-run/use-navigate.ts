"use client";
import { useContext } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

/**
 * Pushes through the app router when one is mounted, else does a full navigation.
 * `useRouter` from next/navigation throws without an app router, and the NL-24
 * shell test renders the dialog with none; this is the only way to stay safe there.
 */
export function useNavigate(): (href: string) => void {
  const router = useContext(AppRouterContext);
  return (href) => {
    if (router) router.push(href);
    else window.location.assign(href);
  };
}
