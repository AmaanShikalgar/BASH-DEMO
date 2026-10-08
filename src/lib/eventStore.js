// Server-only event store.
// Seed events live in src/data/seedEvents.js; events created through the app are
// persisted to data/created-events.json (needs a writable disk, i.e. `next dev` or
// `next start` on a normal server; swap this file for a database on serverless hosts).
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { seedEvents } from "@/data/seedEvents";
import { withLock } from "@/lib/db";

const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "created-events.json");

async function readCreated() {
    try {
        const parsed = JSON.parse(await fs.readFile(FILE, "utf8"));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export async function listEvents({ city, genre, q } = {}) {
    const created = await readCreated();
    // newest created events first, then the seed events
    let events = [...created.reverse(), ...seedEvents];

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
    const all = await listEvents();
    return all.find((e) => e.id === id) || null;
}

export function createEvent(data) {
    return withLock("created-events", async () => {
        const event = {
            ...data,
            id: crypto.randomBytes(12).toString("hex"),
            created_at: new Date().toISOString(),
        };
        const created = await readCreated();
        created.push(event);
        await fs.mkdir(DIR, { recursive: true });
        const tmp = `${FILE}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(created, null, 2));
        await fs.rename(tmp, FILE);
        return event;
    });
}
