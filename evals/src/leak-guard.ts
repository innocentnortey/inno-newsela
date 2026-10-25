// NL-49 AC-7
import { InvariantViolation } from "@ls/core/errors";

const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASSWD/i;

export function make_leak_guard(env: Record<string, string | undefined>): (where: string, value: unknown) => void {
  const secrets = Object.entries(env)
    .filter(([k, v]) => SECRET_NAME.test(k) && v !== undefined && v.length >= 8)
    .map(([, v]) => v as string);
  return (where, value) => {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const bad = secrets.some((s) => text.includes(s)) || /\bsk-[A-Za-z0-9_-]{8,}/.test(text) || /restricted\//i.test(text);
    // Never include the matched text: only the label.
    if (bad) throw new InvariantViolation("eval output holds a secret or restricted path", { where });
  };
}
