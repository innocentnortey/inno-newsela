import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { PageHeader } from "@/components/layout/page-header";
import { RoleNote } from "@/features/frame/conventions";
import { ADOPT_WHOLE, BACK, LEAVE, META, NOTE, ONLY_REVIEWERS } from "./copy";

export interface CandidateHeaderProps {
  versionLabel: string;
  /** The regenerate note for this candidate (CHG-4); nothing is shown when empty. */
  note?: string | null;
  adopted: boolean;
  lessonHref: string;
  lessonLabel: string;
  /** Adoption controls are offered (reviewer, ready, not adopted, editable lesson). */
  canAdopt: boolean;
  /** Show the "Only reviewers" sentence (the person is not a reviewer). */
  notReviewer: boolean;
  busy: string | null;
  onAdoptWhole: () => void;
}

export function CandidateHeader(p: CandidateHeaderProps) {
  const actions = p.canAdopt ? (
    <>
      <Button variant="primary" loading={p.busy === "whole"} disabled={p.busy !== null} onClick={p.onAdoptWhole}>
        {ADOPT_WHOLE}
      </Button>
      <Link href={p.lessonHref}>{LEAVE}</Link>
    </>
  ) : (
    <Link href={p.lessonHref}>{BACK(p.lessonLabel)}</Link>
  );
  return (
    <PageHeader
      title={`${p.versionLabel} · ${p.adopted ? "adopted" : "not adopted"}`}
      meta={
        <>
          {META}
          {p.note ? ` · ${NOTE(p.note)}` : null}
          {p.notReviewer ? <RoleNote>{ONLY_REVIEWERS}</RoleNote> : null}
        </>
      }
      actions={actions}
    />
  );
}
