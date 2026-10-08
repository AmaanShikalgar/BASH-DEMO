import { NextResponse } from "next/server";
import { getEvent } from "@/lib/eventStore";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
    const event = await getEvent(params.id);
    if (!event) {
        return NextResponse.json({ detail: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
}
