// Neon Postgres connection (server only).
// Uses Neon's serverless driver, which talks to Postgres over HTTPS, so it works
// on Vercel serverless/edge functions with no connection pooling headaches.
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

let _sql = null;
export function getSql() {
    if (_sql) return _sql;
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error(
            "DATABASE_URL is not set. Add your Neon connection string to .env.local (and to Vercel env vars).",
        );
    }
    // Next.js 14 caches server-side fetch() calls, and the Neon HTTP driver uses fetch,
    // so identical queries could return stale results. Always bypass that cache.
    _sql = neon(url, { fetchOptions: { cache: "no-store" } });
    return _sql;
}

/** Tagged-template query helper: await sql`select * from users where id = ${id}` */
export const sql = (strings, ...values) => getSql()(strings, ...values);

// Run a plain SQL string. Newer driver versions (1.x) use sql.query(); 0.x calls sql(string) directly.
const run = (q, text) => (typeof q.query === "function" ? q.query(text) : q(text));

/* ---------- schema (idempotent; also available as scripts/schema.sql) ---------- */
const STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS users (
        id            text PRIMARY KEY,
        name          text NOT NULL,
        email         text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS events (
        id         text PRIMARY KEY,
        data       jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
        id             text PRIMARY KEY,
        user_id        text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_id       text NOT NULL,
        tier           text NOT NULL,
        quantity       integer NOT NULL,
        amount         integer NOT NULL,
        attendee_name  text NOT NULL,
        attendee_email text NOT NULL,
        attendee_phone text NOT NULL,
        id_type        text NOT NULL,
        id_last4       text NOT NULL,
        event_title    text,
        event_venue    text,
        event_city     text,
        event_date     text,
        event_time     text,
        event_image    text,
        status         text NOT NULL DEFAULT 'pending',
        ticket_code    text UNIQUE,
        payment_method text,
        paid_at        timestamptz,
        created_at     timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS bookings_user_idx ON bookings (user_id, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS login_attempts (
        email      text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS login_attempts_idx ON login_attempts (email, created_at)`,
];

let ready = null;

/**
 * Creates tables on first use (once per server instance) and seeds the demo user.
 * Every store function awaits this, so no manual migration step is required.
 */
export function ensureReady() {
    if (!ready) {
        ready = (async () => {
            const q = getSql();
            for (const stmt of STATEMENTS) {
                try {
                    await run(q, stmt);
                } catch (e) {
                    // two cold starts racing on CREATE TABLE IF NOT EXISTS: retry once
                    await run(q, stmt);
                }
            }
            if (process.env.DEMO_USER !== "off") {
                const existing = await q`SELECT 1 FROM users WHERE email = 'test@bash.in'`;
                if (existing.length === 0) {
                    const salt = crypto.randomBytes(16).toString("hex");
                    const hash = (await scrypt("test1234", salt, 64)).toString("hex");
                    await q`INSERT INTO users (id, name, email, password_hash)
                            VALUES (${crypto.randomBytes(12).toString("hex")}, 'Test User', 'test@bash.in', ${salt + ":" + hash})
                            ON CONFLICT (email) DO NOTHING`;
                }
            }
        })().catch((e) => {
            ready = null; // let the next request try again
            throw e;
        });
    }
    return ready;
}

export const STATEMENTS_SQL = STATEMENTS.map((s) => s + ";").join("\n\n");
