"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useNav } from "@/lib/useNav";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";
import { homeFor } from "@/lib/roleHome";
import BusinessLeadForm from "@/components/BusinessLeadForm";

const input =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 font-body text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/40";
const submitCls =
    "w-full rounded-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 font-display font-semibold hover:scale-[1.01] transition disabled:opacity-50";
const linkCls = "text-purple-400 hover:text-purple-300";

const COPY = {
    guest: {
        login: ["Welcome back.", "Sign in to see your tickets."],
        register: ["Join the party.", "Create an account in seconds."],
    },
    club: {
        login: ["Club login.", "Manage events, bookings and your door."],
        register: ["Put your club on Bash.", "Tell us who you are. We handle the rest."],
    },
};

// Demo hints (the demo accounts are created unless DEMO_USER=off).
const DEMO = {
    guest: { email: "test@bash.in", password: "test1234" },
    club: { email: "club@bash.in", password: "club1234" },
};

function AudienceToggle({ audience, onChange }) {
    return (
        <div role="tablist" className="grid grid-cols-2 p-1 rounded-full bg-white/5 border border-white/10 mb-8" data-testid="audience-toggle">
            {[
                ["guest", "I'm a guest"],
                ["club", "I run a club"],
            ].map(([id, label]) => (
                <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={audience === id}
                    data-testid={`audience-${id}`}
                    onClick={() => onChange(id)}
                    className={`rounded-full py-2.5 font-body text-sm transition ${audience === id ? "bg-white text-black font-semibold" : "text-white/60 hover:text-white"}`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

function LoginForm({ audience }) {
    const { login } = useAuth();
    const nav = useNav();
    const sp = useSearchParams();
    const [email, setEmail] = useState(DEMO[audience].email);
    const [password, setPassword] = useState(DEMO[audience].password);
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            const u = await login(email, password);
            if (audience === "club" && u?.role === "user") {
                toast.info("That is a guest account, so we took you to the guest home.");
            }
            // a ?next= from a protected page wins; otherwise go to the role's own panel
            nav(sp.get("next") || homeFor(u?.role));
        } catch (e) {
            setErr(formatErr(e.response?.data?.detail) || e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <form onSubmit={submit} className="space-y-3">
                <input data-testid="auth-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
                <input data-testid="auth-password" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className={input} />
                {err && <div data-testid="auth-error" className="text-sm text-red-400 font-body">{err}</div>}
                <button type="submit" disabled={loading} data-testid="auth-submit" className={submitCls}>
                    {loading ? "Please wait…" : "Sign in"}
                </button>
            </form>

            <div className="text-center mt-6 text-sm font-body text-white/60">
                {audience === "guest" ? (
                    <>New to Bash? <Link href="/register" className={linkCls} data-testid="goto-register">Create account</Link></>
                ) : (
                    <>Club logins are created by the Bash team. Not on Bash yet? <Link href="/register?as=club" className={linkCls} data-testid="goto-register">Request access</Link></>
                )}
            </div>

            <div className="mt-8 rounded-xl bg-white/5 border border-white/10 p-4 text-xs font-body text-white/50 text-center">
                Demo: <span className="text-white/80">{DEMO[audience].email}</span> / <span className="text-white/80">{DEMO[audience].password}</span>
            </div>
        </>
    );
}

function GuestSignupForm() {
    const { register } = useAuth();
    const nav = useNav();
    const sp = useSearchParams();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setErr("");
        setLoading(true);
        try {
            const u = await register(name, email, password);
            nav(sp.get("next") || homeFor(u?.role));
        } catch (e) {
            setErr(formatErr(e.response?.data?.detail) || e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <form onSubmit={submit} className="space-y-3">
                <input data-testid="auth-name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required className={input} />
                <input data-testid="auth-email" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
                <input data-testid="auth-password" type="password" placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={input} />
                {err && <div data-testid="auth-error" className="text-sm text-red-400 font-body">{err}</div>}
                <button type="submit" disabled={loading} data-testid="auth-submit" className={submitCls}>
                    {loading ? "Please wait…" : "Create account"}
                </button>
            </form>
            <div className="text-center mt-6 text-sm font-body text-white/60">
                Already have an account? <Link href="/login" className={linkCls} data-testid="goto-login">Sign in</Link>
            </div>
        </>
    );
}

export default function AuthPage({ mode = "login" }) {
    const sp = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const audience = sp.get("as") === "club" ? "club" : "guest";
    const [title, sub] = COPY[audience][mode];

    const switchTo = (a) => {
        const q = new URLSearchParams(sp.toString());
        if (a === "club") q.set("as", "club");
        else q.delete("as");
        const s = q.toString();
        router.replace(s ? `${pathname}?${s}` : pathname);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-5">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
                <Link href="/" className="flex items-center gap-2 justify-center mb-8" data-testid="auth-brand-link">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-display font-bold">B</div>
                    <span className="font-display text-2xl">Bash</span>
                </Link>

                <AudienceToggle audience={audience} onChange={switchTo} />

                {/* the success screen of the club form brings its own heading */}
                <h1 className="font-display text-4xl font-bold tracking-tight text-center">{title}</h1>
                <p className="font-body text-white/60 text-center mt-2 mb-8">{sub}</p>

                {/* key remounts the form when switching, so fields start clean */}
                {mode === "login" && <LoginForm key={`login-${audience}`} audience={audience} />}
                {mode === "register" && audience === "guest" && <GuestSignupForm key="signup-guest" />}
                {mode === "register" && audience === "club" && <BusinessLeadForm key="signup-club" />}

                {mode === "register" && audience === "club" && (
                    <div className="text-center mt-6 text-sm font-body text-white/60">
                        Already onboarded? <Link href="/login?as=club" className={linkCls} data-testid="goto-login">Club sign in</Link>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
