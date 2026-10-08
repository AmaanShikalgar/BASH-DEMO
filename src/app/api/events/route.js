import { NextResponse } from "next/server";
import { listEvents, createEvent } from "@/lib/eventStore";
import { normalizeEvent } from "@/lib/eventSchema";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req) {
    const sp = new URL(req.url).searchParams;
    const events = await listEvents({
        city: sp.get("city") || undefined,
        genre: sp.get("genre") || undefined,
        q: sp.get("q") || undefined,
    });
    return NextResponse.json(events);
}

export async function POST(req) {
    // Only signed-in users can create events.
    const user = await getUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ detail: "Sign in to create an event" }, { status: 401 });
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
    }

    const { event, errors } = normalizeEvent(body);
    if (errors) {
        return NextResponse.json(
            { detail: errors.map((msg) => ({ msg })) },
            { status: 422 },
        );
    }

    try {
        const saved = await createEvent(event);
        return NextResponse.json(saved, { status: 201 });
    } catch (e) {
        console.error("createEvent failed", e);
        return NextResponse.json(
            { detail: "Could not save the event on this server" },
            { status: 500 },
        );
    }
}
