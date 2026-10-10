import { getUserFromRequest } from "@/lib/auth";
import { changePassword } from "@/lib/profileStore";
import { fail, ok, route } from "@/lib/http";

export const dynamic = "force-dynamic";

// Body: { current, next }
export const POST = route(async (req) => {
    const user = await getUserFromRequest(req);
    if (!user) return fail("Sign in first", 401);
    const b = await req.json().catch(() => ({}));
    return ok(await changePassword(user.id, b.current, b.next));
});
