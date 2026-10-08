// Server-only auth: users in data/users.json, scrypt password hashes, signed tokens.
import crypto from "crypto";
import { promisify } from "util";
import { readJson, writeJson, withLock } from "@/lib/db";

const scrypt = promisify(crypto.scrypt);
const USERS = "users.json";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ---------- secret ---------- */
let cachedSecret = null;
async function getSecret() {
    if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
    if (cachedSecret) return cachedSecret;
    return withLock("auth-secret", async () => {
        let stored = await readJson("auth-secret.json", null);
        if (!stored?.secret) {
            stored = { secret: crypto.randomBytes(32).toString("hex") };
            await writeJson("auth-secret.json", stored);
        }
        cachedSecret = stored.secret;
        return cachedSecret;
    });
}

/* ---------- passwords ---------- */
export async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)).toString("hex");
    return `${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
    const [salt, hash] = String(stored).split(":");
    if (!salt || !hash) return false;
    const attempt = await scrypt(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return attempt.length === expected.length && crypto.timingSafeEqual(attempt, expected);
}

/* ---------- tokens ---------- */
const b64 = (buf) => Buffer.from(buf).toString("base64url");

export async function signToken(userId) {
    const body = b64(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS }));
    const sig = crypto.createHmac("sha256", await getSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
}

async function verifyToken(token) {
    const [body, sig] = String(token).split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", await getSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
        return payload.exp > Date.now() ? payload : null;
    } catch {
        return null;
    }
}

/* ---------- users ---------- */
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// Demo account matching the prefilled login form (test@bash.in / test1234).
// Set DEMO_USER=off in your environment to skip creating it.
let seeding = null;
function seedOnce() {
    if (!seeding) {
        seeding = withLock(USERS, async () => {
            if (process.env.DEMO_USER === "off") return;
            const users = await readJson(USERS, []);
            if (users.some((u) => u.email === "test@bash.in")) return;
            users.push({
                id: crypto.randomBytes(12).toString("hex"),
                name: "Test User",
                email: "test@bash.in",
                password_hash: await hashPassword("test1234"),
                created_at: new Date().toISOString(),
            });
            await writeJson(USERS, users);
        }).catch((e) => {
            seeding = null;
            throw e;
        });
    }
    return seeding;
}

async function loadUsers() {
    await seedOnce();
    return readJson(USERS, []);
}

export const findUserByEmail = async (email) =>
    (await loadUsers()).find((u) => u.email === String(email).trim().toLowerCase()) || null;

export async function createUser({ name, email, password }) {
    await seedOnce(); // must run before taking the lock below
    return withLock(USERS, async () => {
        const users = await readJson(USERS, []);
        const clean = String(email).trim().toLowerCase();
        if (users.some((u) => u.email === clean)) return null; // already registered
        const user = {
            id: crypto.randomBytes(12).toString("hex"),
            name: String(name).trim(),
            email: clean,
            password_hash: await hashPassword(password),
            created_at: new Date().toISOString(),
        };
        users.push(user);
        await writeJson(USERS, users);
        return user;
    });
}

/** Reads "Authorization: Bearer <token>" and returns the user, or null. */
export async function getUserFromRequest(req) {
    const header = req.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return null;
    const payload = await verifyToken(token);
    if (!payload) return null;
    const users = await loadUsers();
    return users.find((u) => u.id === payload.sub) || null;
}

/* ---------- login throttle (in memory): 5 failures / 10 min per email ---------- */
const failures = new Map();
const WINDOW = 10 * 60 * 1000;
export function isThrottled(email) {
    const rec = failures.get(email);
    if (!rec) return false;
    if (Date.now() - rec.first > WINDOW) {
        failures.delete(email);
        return false;
    }
    return rec.count >= 5;
}
export function recordFailure(email) {
    const rec = failures.get(email);
    if (!rec || Date.now() - rec.first > WINDOW) failures.set(email, { count: 1, first: Date.now() });
    else rec.count += 1;
}
export const clearFailures = (email) => failures.delete(email);
