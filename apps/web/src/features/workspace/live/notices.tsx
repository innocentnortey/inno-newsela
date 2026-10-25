import { Banner } from "@/components/ui/banner";
import { Link } from "@/components/ui/link";

export function DisconnectedBanner() {
  return <Banner level="advisory" title="Reconnecting: your last edits are not saved yet. Submit is off until they are." />;
}

export function refused_reason_phrase(mode_state: string | null): string {
  if (mode_state === "submitted") return "was submitted";
  if (mode_state === "approved" || mode_state === "exported") return "was approved";
  return "is locked";
}

function truncate(s: string): string {
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

export function RefusedNotice(props: { lesson_label: string; reason_phrase: string; removed_text: string[] }) {
  const removed = props.removed_text.join("");
  return (
    <Banner
      level="blocking"
      title={`Your last edits were not saved because ${props.lesson_label} ${props.reason_phrase}. They have been removed from your view.`}
    >
      {removed.trim() !== "" ? <p>{`Removed text: “${truncate(removed)}”`}</p> : null}
    </Banner>
  );
}

export function SignedOutNotice(props: { signInHref: string }) {
  return (
    <Banner
      level="blocking"
      title="Your session has ended. Sign in again to keep editing."
      action={<Link href={props.signInHref}>Sign in</Link>}
    />
  );
}
