// Server-only bookings store (data/bookings.json).
import crypto from "crypto";
import { readJson, writeJson, withLock } from "@/lib/db";

const FILE = "bookings.json";

// Fields returned to the client (no raw ID number, no user id)
const view = ({ user_id, ...rest }) => rest;

export async function listBookingsForUser(userId) {
    const all = await readJson(FILE, []);
    return all
        .filter((b) => b.user_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(view);
}

export function createBooking(data) {
    return withLock(FILE, async () => {
        const all = await readJson(FILE, []);
        const booking = {
            ...data,
            id: crypto.randomBytes(12).toString("hex"),
            status: "pending",
            ticket_code: null,
            created_at: new Date().toISOString(),
        };
        all.push(booking);
        await writeJson(FILE, all);
        return view(booking);
    });
}

/** Marks a pending booking as paid + confirmed. Returns null if not found / not yours. */
export function payBooking({ bookingId, userId, method }) {
    return withLock(FILE, async () => {
        const all = await readJson(FILE, []);
        const b = all.find((x) => x.id === bookingId && x.user_id === userId);
        if (!b) return null;
        if (b.status !== "confirmed") {
            const taken = new Set(all.map((x) => x.ticket_code).filter(Boolean));
            let code;
            do {
                code = `BASH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
            } while (taken.has(code));
            b.status = "confirmed";
            b.ticket_code = code;
            b.payment_method = method;
            b.paid_at = new Date().toISOString();
            await writeJson(FILE, all);
        }
        return view(b);
    });
}
