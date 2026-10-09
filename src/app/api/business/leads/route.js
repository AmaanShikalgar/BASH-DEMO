import { createLead } from "@/lib/leadStore";
import { notifyNewLead } from "@/lib/email";
import { ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Public: a club asks to join. No account is created here. The Bash team follows up and
// onboards the club from the Developer panel (Leads tab).
export const POST = route(async (req) => {
    const body = await req.json().catch(() => ({}));
    // Honeypot: real people never see or fill this field. Pretend it worked.
    if (body.company_site) return ok({ ok: true }, 201);

    const lead = await createLead(body);
    await notifyNewLead(lead);
    return ok({ ok: true }, 201);
});
