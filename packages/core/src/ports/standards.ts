export interface StandardRow {
  code: string;
  set: "CA_CCSS_ELA_6" | "CA_ELD_6" | "MSLS_6";
  text: string;
  parent_code: string | null;
  is_leaf: boolean;
  eld_strand: string | null;
}

export interface StandardResolution {
  input_code: string;
  status: "ok" | "malformed" | "unknown" | "parent";
  resolved: string[];
  suggestion: string | null;
  eld_label_mismatch: boolean;
}

// Implemented later in core; defined here so ports need no forward import.
export interface StandardsIndex {
  // sheet_label: the label the outline gives an ELD code, compared with the official text
  resolve(code: string, sheet_label?: string | null): StandardResolution;
  leaves_of(code: string): string[];
  text_of(code: string): string | null;
}

export interface StandardRepo {
  index(): Promise<StandardsIndex>;
  texts(codes: readonly string[]): Promise<StandardRow[]>;
}
