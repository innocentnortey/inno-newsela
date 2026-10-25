// Test helper (frozen with the NL-08 tests): insert a row by naming only the columns a test cares about.
// Every other NOT NULL column without a default gets a type-appropriate dummy, so the tests do not
// depend on the exact column list of tables they are not about.
interface Q {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}
let counter = 0;

function dummy(udt: string): unknown {
  counter += 1;
  switch (udt) {
    case "text":
    case "varchar":
      return `x_${counter}_${Math.random().toString(36).slice(2, 8)}`;
    case "int2":
    case "int4":
    case "int8":
      return 0;
    case "numeric":
      return "0";
    case "bool":
      return false;
    case "jsonb":
    case "json":
      return "{}";
    case "timestamptz":
    case "timestamp":
      return new Date().toISOString();
    case "bytea":
      return Buffer.alloc(0);
    default:
      return `x_${counter}`;
  }
}

export async function insert_row(q: Q, table: string, given: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cols = await q.query(
    `select column_name, udt_name, is_nullable, column_default, is_generated, is_identity
       from information_schema.columns where table_schema='public' and table_name=$1`,
    [table],
  );
  if (cols.rows.length === 0) throw new Error(`no such table: ${table}`);
  const values: Record<string, unknown> = { ...given };
  const udt: Record<string, string> = {};
  for (const c of cols.rows) {
    udt[c.column_name] = c.udt_name;
    if (c.column_name in values) continue;
    if (c.is_nullable === "YES" || c.column_default !== null || c.is_generated === "ALWAYS" || c.is_identity === "YES") continue;
    values[c.column_name] = dummy(c.udt_name);
  }
  const names = Object.keys(values);
  for (const n of names) if (!(n in udt)) throw new Error(`no such column: ${table}.${n}`);
  const params = names.map((n, i) => {
    const t = udt[n]!;
    return `$${i + 1}::${t === "bytea" ? "bytea" : t.startsWith("_") ? t.slice(1) + "[]" : t}`;
  });
  const args = names.map((n) => {
    const v = values[n];
    return v !== null && typeof v === "object" && !(v instanceof Date) && !Buffer.isBuffer(v) ? JSON.stringify(v) : v;
  });
  const r = await q.query(
    `insert into ${table} (${names.join(",")}) values (${params.join(",")}) returning to_jsonb(${table}.*) as row`,
    args,
  );
  return r.rows[0].row as Record<string, unknown>;
}
