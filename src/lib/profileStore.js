// Server-only profile store: name, email, Bash ID, masked ID number, Instagram, two photos.
// Only the LAST 4 digits of an ID number are ever stored (in bookings), so the full
// Aadhaar number is never shown or kept.
import crypto from "crypto";
import { sql, ensureReady } from "@/lib/db";
import { BookingError } from "@/lib/bookingStore";
import { CITIES } from "@/lib/geo";
import { hashPassword, verifyPassword } from "@/lib/auth";

const IMAGE_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_BYTES = 2 * 1024 * 1024;
const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
const iso = (v) => (v ? new Date(v).toISOString() : null);

const maskId = (type, last4) => (type === "Aadhaar" ? `XXXX XXXX ${last4}` : `${type} •••• ${last4}`);

/** Accepts "@name", "name", or a full instagram.com link. Returns the bare username, or null. */
export function normalizeInstagram(raw) {
    let v = String(raw ?? "").trim();
    if (!v) return null;
    v = v
        .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
        .replace(/[?#].*$/, "")
        .replace(/\/.*$/, "")
        .replace(/^@/, "");
    if (!HANDLE_RE.test(v)) {
        throw new BookingError("Enter a valid Instagram username, for example @yourname", 422);
    }
    return v;
}

export async function getProfile(userId) {
    await ensureReady();
    const u = (
        await sql`SELECT name, email, bash_id, instagram, photo_top, photo_side, created_at,
                         phone, city, dob, role
                    FROM users WHERE id = ${userId}`
    )[0];
    if (!u) return null;
    const latest = (
        await sql`SELECT id_type, id_last4 FROM bookings
                   WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`
    )[0];
    const stats = (
        await sql`SELECT
                    count(*) FILTER (WHERE status IN ('approved','pending'))::int AS tickets,
                    count(*) FILTER (WHERE used_at IS NOT NULL)::int AS attended,
                    count(DISTINCT event_id) FILTER (WHERE status IN ('approved','pending'))::int AS events
                  FROM bookings WHERE user_id = ${userId}`
    )[0];
    return {
        name: u.name,
        email: u.email,
        phone: u.phone || null,
        city: u.city || null,
        dob: u.dob ? new Date(u.dob).toISOString().slice(0, 10) : null,
        role: u.role || "user",
        stats: { tickets: stats?.tickets ?? 0, attended: stats?.attended ?? 0, events: stats?.events ?? 0 },
        bash_id: u.bash_id,
        instagram: u.instagram,
        photo_top: u.photo_top,
        photo_side: u.photo_side,
        id_type: latest?.id_type ?? null,
        id_masked: latest ? maskId(latest.id_type, latest.id_last4) : null,
        member_since: iso(u.created_at),
    };
}

export async function updateInstagram(userId, raw) {
    await ensureReady();
    const handle = normalizeInstagram(raw);
    await sql`UPDATE users SET instagram = ${handle} WHERE id = ${userId}`;
    return getProfile(userId);
}

/** slot: "top" | "side". Replaces the old photo and deletes its stored image. */
export async function setProfilePhoto(userId, slot, dataUrl) {
    if (slot !== "top" && slot !== "side") throw new BookingError("Unknown photo slot", 422);
    const m = IMAGE_RE.exec(String(dataUrl || ""));
    if (!m) throw new BookingError("Photo must be a JPG, PNG or WebP image", 422);
    if (Buffer.byteLength(m[2], "base64") > MAX_BYTES) throw new BookingError("Photo must be under 2 MB", 422);

    await ensureReady();
    const assetId = crypto.randomBytes(12).toString("hex");
    await sql`INSERT INTO assets (id, mime, data) VALUES (${assetId}, ${m[1]}, ${m[2]})`;
    const url = `/api/assets/${assetId}`;

    const cur = (await sql`SELECT photo_top, photo_side FROM users WHERE id = ${userId}`)[0];
    if (slot === "top") {
        await sql`UPDATE users SET photo_top = ${url} WHERE id = ${userId}`;
    } else {
        await sql`UPDATE users SET photo_side = ${url} WHERE id = ${userId}`;
    }
    const old = slot === "top" ? cur?.photo_top : cur?.photo_side;
    if (old) {
        const oldId = old.replace("/api/assets/", "");
        await sql`DELETE FROM assets WHERE id = ${oldId}`;
    }
    return getProfile(userId);
}

/** Body: any of { name, phone, city, instagram }. Only the fields that are sent are changed. */
export async function updateDetails(userId, b = {}) {
    await ensureReady();
    if (b.name !== undefined) {
        const name = String(b.name).trim().slice(0, 80);
        if (!name) throw new BookingError("Name can't be empty", 422);
        await sql`UPDATE users SET name = ${name} WHERE id = ${userId}`;
    }
    if (b.phone !== undefined) {
        const phone = String(b.phone).replace(/[\s-]/g, "").slice(0, 15);
        if (!/^(\+91)?[6-9]\d{9}$/.test(phone)) throw new BookingError("Enter a valid 10-digit mobile number", 422);
        await sql`UPDATE users SET phone = ${phone} WHERE id = ${userId}`;
    }
    if (b.city !== undefined) {
        const city = String(b.city).trim();
        if (!CITIES.some((c) => c.slug === city)) throw new BookingError("Choose a city from the list", 422);
        await sql`UPDATE users SET city = ${city} WHERE id = ${userId}`;
    }
    if (b.instagram !== undefined) {
        const handle = normalizeInstagram(b.instagram);
        await sql`UPDATE users SET instagram = ${handle} WHERE id = ${userId}`;
    }
    return getProfile(userId);
}

export async function changePassword(userId, current, next) {
    await ensureReady();
    const u = (await sql`SELECT password_hash FROM users WHERE id = ${userId}`)[0];
    if (!u || !(await verifyPassword(String(current ?? ""), u.password_hash))) {
        throw new BookingError("Current password is incorrect", 403);
    }
    const n = String(next ?? "");
    if (n.length < 6 || n.length > 200) throw new BookingError("New password must be at least 6 characters", 422);
    await sql`UPDATE users SET password_hash = ${await hashPassword(n)} WHERE id = ${userId}`;
    return { ok: true };
}
