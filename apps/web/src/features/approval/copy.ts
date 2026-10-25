// Every user-facing string of SCR-14 (SCREEN_SPECS "Copy fixed by the flows").
export const COPY = {
  eyebrow: "Approval review",
  checklistHeading: "Checklist",
  checklistSub: "each with its evidence",
  textHeading: (short: string) => `Lesson text (frozen at ${short})`,
  decisionTitle: "Your decision",
  ratingLegend: "Draft quality",
  ratingError: "Choose a rating to approve.",
  fourEyesOk: "Four eyes",
  fourEyesOkBody: "You did not edit this lesson, so you can approve it.",
  fourEyesNo:
    "Someone else must approve: you were the last editor of this lesson (including AI accepts and adopted candidates).",
  fourEyesReason: "Someone else must approve",
  approve: "Approve this version",
  requestChanges: "Request changes",
  reopen: "Reopen…",
  pinSmall: (short: string) =>
    `Approving pins snapshot ${short}. If it changes before you approve, you'll be asked to reload.`,
  stale: "This lesson changed since you opened it. Reload.",
  reload: "Reload",
  blocked: (msg: string) => `Approve refused: ${msg.replace(/\.$/, "")}.`,
  dependencyItem: (n: string) => `Homework text — Lesson ${n} must be approved first`,
  dependencyReason: (n: string) => `Lesson ${n} must be approved first`,
  waitingOnYou: (n: string) => `Lesson ${n} is waiting on this lesson's excerpt.`,
  nowApprovable: (n: string) => `Lesson ${n} can now be approved.`,
  openLesson: (n: string) => `Open Lesson ${n}`,
  network: "Couldn't reach the server. Your rating is kept. Try again.",
  onlyApprovers: "Only approvers can approve",
  toast: (n: string) => `Lesson ${n} approved.`,
  approvedBanner: (name: string, short: string, ratingLabel: string) =>
    `Approved by ${name} · pinned ${short} · ${ratingLabel}`,
  approvedOn: (name: string, on: string | null) => (on ? `Approved by ${name} on ${on}` : `Approved by ${name}`),
  exportedLine: "Included in an export",
  notSubmitted: (n: string, state: string, reviewer: string | null) => {
    switch (state) {
      case "in_review":
        return reviewer
          ? `Lesson ${n} isn't submitted yet. It's in review with ${reviewer}.`
          : `Lesson ${n} isn't submitted yet. It's in review.`;
      case "draft":
        return `Lesson ${n} isn't submitted yet. It's a draft.`;
      case "reopened":
        return `Lesson ${n} was reopened and is being edited.`;
      case "changes_requested":
        return `Lesson ${n} was sent back for changes.`;
      default:
        return `Lesson ${n} has no draft yet.`;
    }
  },
  openReadOnly: (n: string) => `Open Lesson ${n} read-only`,
  loading: "Loading the approval review",
  cantLoadThing: "the approval review",
  frozenExcerptPlaceholder: "Excerpt or quote still to be inserted",
} as const;
