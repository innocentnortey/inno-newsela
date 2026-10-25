// NL-90 support: thin pg wrapper bound to the stack's database.
import pg from "pg";
import { getStack } from "./real-stack";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  count(table: string, where?: string, params?: unknown[]): Promise<number>;
  dumpAll(): Promise<string>;
  close(): Promise<void>;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

export function connectDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await pool.query(sql, params);
      return r.rows as T[];
    },
    async count(table, where, params = []) {
      if (!IDENT.test(table)) throw new Error(`bad table name: ${table}`);
      const r = await pool.query(`select count(*)::int as n from ${table}${where ? ` where ${where}` : ""}`, params);
      return (r.rows[0] as { n: number }).n;
    },
    async dumpAll() {
      const t = await pool.query("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1");
      const parts: string[] = [];
      for (const { table_name } of t.rows as { table_name: string }[]) {
        if (!IDENT.test(table_name)) continue;
        const r = await pool.query(`select t::text as row from ${table_name} t`);
        parts.push(`## ${table_name}`, ...(r.rows as { row: string }[]).map((x) => x.row));
      }
      return parts.join("\n");
    },
    close: () => pool.end(),
  };
}

let cached: { url: string; db: Db } | undefined;
export const db = (): Db => {
  const url = getStack().databaseUrl;
  if (!cached || cached.url !== url) cached = { url, db: connectDb(url) };
  return cached.db;
};
