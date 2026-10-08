// Server-only event store.
// Seed events live in src/data/seedEvents.js (static, shipped with the build).
// Events created through the app are stored in Neon (table: events, jsonb data).
import crypto from "crypto";
import { seedEvents } from "@/data/seedEvents";
import { sql, ensureReady } from "@/lib/db";

async function readCreated() {
    await ensureReady();
    const rows = await sql`SELECT id, data, created_at FROM events ORDER BY created_at DESC`;
    return rows.map((r) => ({
        ...r.data,
        id: r.id,
        created_at: new Date(r.created_at).toISOString(),
    }));
}

export async function listEvents({ city, genre, q } = {}) {
    // newest created events first, then the seed events
    let events = [...(await readCreated()), ...seedEvents];

    if (city && city !== "all") events = events.filter((e) => e.city_slug === city);
    if (genre && genre !== "all") events = events.filter((e) => e.genre_slug === genre);
    if (q) {
        const needle = q.toLowerCase();
        events = events.filter((e) =>
            [e.title, e.artist, e.venue, e.city, e.genre]
                .join(" ")
                .toLowerCase()
                .includes(needle),
        );
    }
    return events;
}

export async function getEvent(id) {
    const seeded = seedEvents.find((e) => e.id === id);
    if (seeded) return seeded;
    await ensureReady();
    const rows = await sql`SELECT id, data, created_at FROM events WHERE id = ${id}`;
    if (!rows.length) return null;
    const r = rows[0];
    return { ...r.data, id: r.id, created_at: new Date(r.created_at).toISOString() };
}

export async function createEvent(data) {
    await ensureReady();
    const id = crypto.randomBytes(12).toString("hex");
    const rows = await sql`
        INSERT INTO events (id, data) VALUES (${id}, ${JSON.stringify(data)}::jsonb)
        RETURNING created_at`;
    return { ...data, id, created_at: new Date(rows[0].created_at).toISOString() };
}
