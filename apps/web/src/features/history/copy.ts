export const COPY = {
  eyebrow: "Lesson history",
  title: (n: string) => `History · Lesson ${n}`,
  versionsHeading: "Versions",
  provenanceHeading: "Provenance",
  auditHeading: "Audit log",
  copyHash: "Copy hash",
  copied: "Copied",
  missing: "Missing",
  notApplicable: "Not applicable (made by a person)",
  noReason: "No reason recorded",
  noStateChange: "No state change",
  noAudit: "No audit rows for this version.",
  loading: "Loading history",
  cantLoadThing: "the history",
} as const;

export const KIND_LABEL = {
  generated: "Generated",
  candidate: "Candidate",
  submit: "Submit snapshot",
  approval: "Approval",
  reopen: "Reopen",
} as const;
