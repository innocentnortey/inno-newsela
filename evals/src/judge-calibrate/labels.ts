// NL-111 step 1: parse evals/judge/labels.csv (NL-122). A small RFC-4180 reader, no dependency.
export const LABEL_HEADER = "pair_id,lesson_id,content_hash,address,code,question,label,labelled_by,labelled_at,split";

export interface LabelRow {
  pair_id: string;
  lesson_id: string;
  content_hash: string;
  address: string;
  code: string;
  question: "teaches_standard" | "eld_keeps_task";
  label: "yes" | "no";
  labelled_by: string;
  labelled_at: string;
  split: "dev" | "holdout";
}

export class LabelsInvalid extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LabelsInvalid";
  }
}

function records(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) out.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new LabelsInvalid("labels.csv has an unterminated quote");
  row.push(field);
  if (row.some((f) => f !== "")) out.push(row);
  return out;
}

export function parse_labels(text: string): LabelRow[] {
  const [head, ...rows] = records(text.replace(/^\u{FEFF}/u, ""));
  if (head === undefined || head.join(",") !== LABEL_HEADER) throw new LabelsInvalid(`labels.csv header must be exactly: ${LABEL_HEADER}`);
  return rows.map((r, i) => {
    const n = i + 2; // row number in the file, header is row 1
    if (r.length !== head.length) throw new LabelsInvalid(`labels.csv row ${n}: expected ${head.length} fields, found ${r.length}`);
    const [pair_id, lesson_id, content_hash, address, code, question, label, labelled_by, labelled_at, split] = r as [
      string, string, string, string, string, string, string, string, string, string,
    ];
    if (pair_id === "" || lesson_id === "" || content_hash === "" || address === "" || code === "") throw new LabelsInvalid(`labels.csv row ${n}: an id field is empty`);
    if (question !== "teaches_standard" && question !== "eld_keeps_task") throw new LabelsInvalid(`labels.csv row ${n}: unknown question`);
    if (label !== "yes" && label !== "no") throw new LabelsInvalid(`labels.csv row ${n}: label must be yes or no`);
    if (split !== "dev" && split !== "holdout") throw new LabelsInvalid(`labels.csv row ${n}: split must be dev or holdout`);
    return { pair_id, lesson_id, content_hash, address, code, question, label, labelled_by, labelled_at, split };
  });
}
