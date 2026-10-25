import type { ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

export function CantLoad({ thing, onRetry }: { thing: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 text-body text-ink">
      <p>{`Couldn't load ${thing}. Check your connection and try again.`}</p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function NotFound({
  what,
  boardHref = "/units/g6-u4/board",
  where = "Grade 6 · Unit 4",
}: {
  what: string;
  boardHref?: string;
  where?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 text-body text-ink">
      <p>{`There is no ${what} in ${where}`}</p>
      <Link href={boardHref}>Back to the board</Link>
    </div>
  );
}

export function StaleBanner({ asOf, thing = "board" }: { asOf: Date; thing?: string }) {
  const hhmm = asOf.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return <Banner level="advisory" title={`Live updates paused. Showing the ${thing} as of ${hhmm}. Retrying…`} />;
}

export function ForbiddenBanner({ message }: { message: string }) {
  return <Banner level="blocking" title={message} />;
}

export function RoleNote({ children }: { children: ReactNode }) {
  return <p className="text-small text-ink2">{children}</p>;
}

export function DisabledReason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} className="text-small text-ink2">
      {children}
    </span>
  );
}
