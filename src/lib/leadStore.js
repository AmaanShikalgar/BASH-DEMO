// Server-only: club "request access" leads (table: business_leads) and the step that turns
// a lead into a hidden club + onboarding application + club admin login.
import crypto from "crypto";
import { sql, ensureReady } from "@/lib/db";
import { BookingError } from "@/lib/bookingStore";
import { LEAD_STATUSES, validateLead } from "@/lib/leads";
import { CITIES } from "@/lib/geo";
import { createUser, findUserByEmail } from "@/lib/auth";
import { createApplicationFromLead } from "@/lib/onboardingStore";
import { setUserRole } from "@/lib/devStore";

const iso = (v) => (v ? new Date(v).toISOString() : null);
const shape = (r) => ({
    ...r,
    city_name: CITIES.find((c) => c.slug === r.city_slug)?.name || r.city_slug,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
});

/** Public sign-up. Max 3 requests per email per day, so the form cannot be used to spam the inbox. */
export async function createLead(raw) {
    await ensureReady();
    const { lead, errors } = validateLead(raw);
    if (errors.length) throw new BookingError(errors.join(" · "), 422);

    const recent = await sql`SELECT count(*)::int AS n FROM business_leads
                              WHERE email = ${lead.email} AND created_at > now() - interval '24 hours'`;
    if (recent[0].n >= 3) throw new BookingError("We already have your request. We will be in touch soon.", 429);

    const id = crypto.randomBytes(12).toString("hex");
    const rows = await sql`
        INSERT INTO business_leads (id, club_name, city_slug, contact_name, phone, email,
                                    instagram, website, contact_pref, message)
        VALUES (${id}, ${lead.club_name}, ${lead.city_slug}, ${lead.contact_name}, ${lead.phone}, ${lead.email},
                ${lead.instagram}, ${lead.website}, ${lead.contact_pref}, ${lead.message})
        RETURNING *`;
    return shape(rows[0]);
}

export async function listLeads() {
    await ensureReady();
    const rows = await sql`SELECT * FROM business_leads ORDER BY
        CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'onboarding' THEN 2 ELSE 3 END,
        created_at DESC LIMIT 300`;
    return rows.map(shape);
}

async function getLead(id) {
    const rows = await sql`SELECT * FROM business_leads WHERE id = ${id}`;
    return rows[0] || null;
}

export async function updateLead(id, { status, dev_notes }) {
    await ensureReady();
    if (status !== undefined && !LEAD_STATUSES.some((s) => s.id === status)) {
        throw new BookingError("Unknown status", 422);
    }
    const notes = dev_notes === undefined ? undefined : String(dev_notes).slice(0, 2000);
    const rows = await sql`
        UPDATE business_leads
           SET status = COALESCE(${status ?? null}, status),
               dev_notes = COALESCE(${notes ?? null}, dev_notes),
               updated_at = now()
         WHERE id = ${id} RETURNING *`;
    if (!rows.length) throw new BookingError("Lead not found", 404);
    return shape(rows[0]);
}

// No look-alike characters (0/O, 1/l/I) so it can be read out over a call.
const PW_CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tempPassword = () => Array.from(crypto.randomBytes(10), (b) => PW_CHARS[b % PW_CHARS.length]).join("");

/**
 * Start onboarding: creates the hidden club + a prefilled application (the existing
 * Club applications flow takes over from here) and a club admin login for the lead's email.
 * Returns the temporary password once. It is not stored anywhere in readable form.
 */
export async function convertLead(id) {
    await ensureReady();
    const lead = await getLead(id);
    if (!lead) throw new BookingError("Lead not found", 404);
    if (lead.club_id) throw new BookingError("Onboarding already started for this lead", 409);

    // Check the login first so we never leave a half-created club behind.
    const existing = await findUserByEmail(lead.email);
    if (existing && existing.role !== "user") {
        throw new BookingError(`${lead.email} already belongs to a ${existing.role} account. Use a different email for this club.`, 409);
    }

    const club = await createApplicationFromLead(lead);

    let password = null;
    let linkedExisting = false;
    if (existing) {
        await setUserRole(existing.id, "club_admin", club.id);
        linkedExisting = true;
    } else {
        password = tempPassword();
        await createUser({ name: lead.contact_name, email: lead.email, password, role: "club_admin", club_id: club.id });
    }

    await sql`UPDATE business_leads SET status = 'onboarding', club_id = ${club.id}, updated_at = now() WHERE id = ${id}`;
    return { club_id: club.id, admin_email: lead.email, temp_password: password, linked_existing: linkedExisting };
}
