// Server-only bookings store (Neon table: bookings).
import crypto from "crypto";
import { sql, ensureReady } from "@/lib/db";

const iso = (v) => (v ? new Date(v).toISOString() : null);

// Fields returned to the client (no user id)
const view = ({ user_id, ...rest }) => ({
    ...rest,
    paid_at: iso(rest.paid_at),
    created_at: iso(rest.created_at),
});

export async function listBookingsForUser(userId) {
    await ensureReady();
    const rows = await sql`
        SELECT * FROM bookings WHERE user_id = ${userId} ORDER BY created_at DESC`;
    return rows.map(view);
}

export async function createBooking(d) {
    await ensureReady();
    const id = crypto.randomBytes(12).toString("hex");
    const rows = await sql`
        INSERT INTO bookings (
            id, user_id, event_id, tier, quantity, amount,
            attendee_name, attendee_email, attendee_phone, id_type, id_last4,
            event_title, event_venue, event_city, event_date, event_time, event_image
        ) VALUES (
            ${id}, ${d.user_id}, ${d.event_id}, ${d.tier}, ${d.quantity}, ${d.amount},
            ${d.attendee_name}, ${d.attendee_email}, ${d.attendee_phone}, ${d.id_type}, ${d.id_last4},
            ${d.event_title}, ${d.event_venue}, ${d.event_city}, ${d.event_date}, ${d.event_time}, ${d.event_image}
        ) RETURNING *`;
    return view(rows[0]);
}

/** Marks a pending booking as paid + confirmed. Returns null if not found / not yours. */
export async function payBooking({ bookingId, userId, method }) {
    await ensureReady();

    const found = await sql`SELECT * FROM bookings WHERE id = ${bookingId} AND user_id = ${userId}`;
    if (!found.length) return null;
    if (found[0].status === "confirmed") return view(found[0]); // already paid: idempotent

    // ticket_code is UNIQUE, so on the (very unlikely) collision we just try a new code
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = `BASH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        try {
            const rows = await sql`
                UPDATE bookings
                   SET status = 'confirmed', ticket_code = ${code},
                       payment_method = ${method}, paid_at = now()
                 WHERE id = ${bookingId} AND user_id = ${userId} AND status <> 'confirmed'
             RETURNING *`;
            if (rows.length) return view(rows[0]);
            // someone else confirmed it between our read and update
            const again = await sql`SELECT * FROM bookings WHERE id = ${bookingId} AND user_id = ${userId}`;
            return again.length ? view(again[0]) : null;
        } catch (e) {
            if (e?.code !== "23505") throw e; // not a unique violation
        }
    }
    throw new Error("Could not allocate a ticket code");
}
