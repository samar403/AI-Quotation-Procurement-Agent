import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { DB } from "./types";
import { emptyDB } from "./seed";

// A small, durable JSON datastore. Every mutation goes through `mutate`, which serialises
// writers and writes atomically (tmp file + rename), so concurrent requests can't corrupt it.
// Swap this module for Postgres when moving past a single-node deployment — the rest of the
// app only depends on `read` and `mutate`.

function dataDir() {
  if (process.env.TAANA_DATA_DIR) return process.env.TAANA_DATA_DIR;
  // Serverless file systems are read-only outside /tmp.
  if (process.env.VERCEL) return path.join(os.tmpdir(), "taana");
  return path.join(process.cwd(), ".data");
}

const file = () => path.join(dataDir(), "db.json");

let chain: Promise<unknown> = Promise.resolve();
let tmpSeq = 0;
let cache: { db: DB; mtimeMs: number } | null = null;

async function load(): Promise<DB> {
  try {
    const stat = await fs.stat(file());
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.db;
    const db = JSON.parse(await fs.readFile(file(), "utf8")) as DB;
    cache = { db, mtimeMs: stat.mtimeMs };
    return db;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    // Not persisted here: only `mutate` writes, so concurrent first reads can't race.
    return emptyDB();
  }
}

async function save(db: DB) {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${file()}.${process.pid}.${Date.now()}.${++tmpSeq}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2));
  await fs.rename(tmp, file());
  const stat = await fs.stat(file());
  cache = { db, mtimeMs: stat.mtimeMs };
}

export async function read(): Promise<DB> {
  await chain.catch(() => undefined);
  return structuredClone(await load());
}

export function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = chain.catch(() => undefined).then(async () => {
    const db = structuredClone(await load());
    const result = await fn(db);
    await save(db);
    return result;
  });
  chain = run;
  return run;
}

export async function reset(db: DB = emptyDB()) {
  return mutate((current) => {
    Object.assign(current, db);
  });
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
