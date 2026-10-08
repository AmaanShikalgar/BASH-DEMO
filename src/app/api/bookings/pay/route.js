import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { payBooking } from "@/lib/bookingStore";

export const dynamic = "force-dynamic";

// NOTE: payment is simulated (same as the original app). Plug a real gateway in here.
export async function POST(req) {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ detail: "Sign in to continue" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const booking = await payBooking({
        bookingId: String(b.booking_id ?? ""),
        userId: user.id,
        method: String(b.payment_method ?? "upi").slice(0, 20),
    });
    if (!booking) return NextResponse.json({ detail: "Booking not found" }, { status: 404 });
    return NextResponse.json(booking);
}
