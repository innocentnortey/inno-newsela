export type IntakeErrorCode = "UNSUPPORTED_FILE" | "HEADER_NOT_FOUND" | "TOO_MANY_ROWS";
export type IntakeDetails = Readonly<Record<string, string | number | boolean | null>>;

/**
 * A refusal of an uploaded outline. The message is a fixed string and the details hold only a reason word
 * and numbers: never cell text (an uploaded file is untrusted, and its text must not leak into logs or errors).
 */
export class IntakeError extends Error {
  readonly code: IntakeErrorCode;
  readonly details: IntakeDetails;

  constructor(code: IntakeErrorCode, details: IntakeDetails) {
    super(`intake refused: ${code}`);
    this.name = "IntakeError";
    this.code = code;
    this.details = details;
  }
}
