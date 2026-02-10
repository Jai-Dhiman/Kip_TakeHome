import { Database } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname, join } from "path";

const DEFAULT_CACHE_PATH = join(
  import.meta.dir,
  "..",
  "..",
  ".cache",
  "execcheck.db"
);

export class Cache {
  private db: Database;

  constructor(dbPath: string = DEFAULT_CACHE_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initTables();
  }

  private initTables(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (namespace, key)
      )
    `);
  }

  get(namespace: string, key: string): unknown | null {
    const row = this.db
      .query<{ value: string }, [string, string]>(
        "SELECT value FROM cache WHERE namespace = ? AND key = ?"
      )
      .get(namespace, key);
    if (row === null) return null;
    return JSON.parse(row.value);
  }

  set(namespace: string, key: string, value: unknown): void {
    this.db.run(
      `INSERT OR REPLACE INTO cache (namespace, key, value) VALUES (?, ?, ?)`,
      [namespace, key, JSON.stringify(value)]
    );
  }

  has(namespace: string, key: string): boolean {
    const row = this.db
      .query<{ found: number }, [string, string]>(
        "SELECT 1 as found FROM cache WHERE namespace = ? AND key = ?"
      )
      .get(namespace, key);
    return row !== null;
  }

  clear(namespace?: string): void {
    if (namespace) {
      this.db.run("DELETE FROM cache WHERE namespace = ?", [namespace]);
    } else {
      this.db.run("DELETE FROM cache");
    }
  }

  close(): void {
    this.db.close();
  }
}
