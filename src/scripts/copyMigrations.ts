import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// tsc only compiles .ts -> .js; it never copies the .sql migration files into dist/. db.ts looks
// for them next to itself at runtime (dist/db/migrations when running compiled output), so
// `npm start` would otherwise crash with ENOENT on a clean dist/ even though `npm run dev` (which
// runs straight from src/) works fine. Run this after `tsc` to mirror them over.
const src = join(process.cwd(), "src", "db", "migrations");
const dest = join(process.cwd(), "dist", "db", "migrations");

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
