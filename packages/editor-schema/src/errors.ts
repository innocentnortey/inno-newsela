export interface SchemaUnknownInit {
  lesson_id: string | null;
  schema_version: number;
  unknown_nodes: readonly string[];
}

/** Thrown when a document holds nodes/marks outside the allow-list, or an unknown schema version. */
export class SchemaUnknownError extends Error {
  readonly lesson_id: string | null;
  readonly schema_version: number;
  readonly unknown_nodes: readonly string[];

  constructor(init: SchemaUnknownInit) {
    const what =
      init.unknown_nodes.length > 0
        ? `unknown nodes or marks: ${init.unknown_nodes.join(", ")}`
        : `unknown schema version ${init.schema_version}`;
    super(`SCHEMA_UNKNOWN: ${what}`);
    this.name = "SchemaUnknownError";
    this.lesson_id = init.lesson_id;
    this.schema_version = init.schema_version;
    this.unknown_nodes = [...init.unknown_nodes];
  }

  /** Returns a NEW error carrying the lesson id; the original is unchanged. */
  with_lesson_id(id: string): SchemaUnknownError {
    return new SchemaUnknownError({
      lesson_id: id,
      schema_version: this.schema_version,
      unknown_nodes: this.unknown_nodes,
    });
  }
}
