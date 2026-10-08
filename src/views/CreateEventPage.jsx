"use client";

import { useState } from "react";
import Link from "next/link";
import { useNav } from "@/lib/useNav";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { api, formatErr, resizeImg } from "@/lib/api";
import { GENRES, LINEUP_ROLES } from "@/lib/eventSchema";
import { useAuth } from "@/context/AuthContext";

const inputCls =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 font-body text-sm text-white placeholder:text-white/30 outline-none focus:border-purple-400 transition";

const emptyForm = () => ({
    title: "",
    artist: "",
    subtitle: "",
    genre: "Pop",
    is_live: false,
    description: "",
    date: "",
    time: "",
    venue: "",
    city: "",
    image: "",
    hero_image: "",
    tiers: [{ name: "General", price: "", note: "", perks: "" }],
    lineup: [{ name: "", role: "Headliner", set_time: "", photo: "" }],
    gallery: [""],
    faqs: [{ q: "", a: "" }],
    location: { address: "", getting_there: "", parking: "" },
    info: { age_limit: "", doors_open: "", duration: "" },
});

// "2026-03-17" -> "17 March 2026"
const fmtDate = (v) =>
    v
        ? new Date(`${v}T00:00:00`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
          })
        : "";

// "19:00" -> "7:00 PM"
const fmtTime = (v) => {
    if (!v) return "";
    const [h, m] = v.split(":").map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

function Card({ title, subtitle, children }) {
    return (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6 mb-5">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            {subtitle && (
                <p className="font-body text-sm text-white/50 mt-1">{subtitle}</p>
            )}
            <div className="mt-5 space-y-4">{children}</div>
        </section>
    );
}

function Field({ label, children, className = "" }) {
    return (
        <label className={`block ${className}`}>
            <span className="block font-body text-xs uppercase tracking-widest text-white/50 mb-2">
                {label}
            </span>
            {children}
        </label>
    );
}

function AddButton({ onClick, children, testid }) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={testid}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 font-body text-sm transition"
        >
            <Plus className="w-4 h-4" /> {children}
        </button>
    );
}

function RemoveButton({ onClick, disabled }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label="Remove"
            className="shrink-0 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
}

export default function CreateEventPage() {
    const { user, loading: authLoading } = useAuth();
    const nav = useNav();
    const [form, setForm] = useState(emptyForm);
    const [err, setErr] = useState("");
    const [saving, setSaving] = useState(false);

    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const setNested = (key, field, value) =>
        setForm((f) => ({ ...f, [key]: { ...f[key], [field]: value } }));
    const setRow = (key, i, field, value) =>
        setForm((f) => ({
            ...f,
            [key]: f[key].map((row, idx) =>
                idx === i ? (field ? { ...row, [field]: value } : value) : row,
            ),
        }));
    const addRow = (key, row) => setForm((f) => ({ ...f, [key]: [...f[key], row] }));
    const removeRow = (key, i) =>
        setForm((f) => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));

    const submit = async (e) => {
        e.preventDefault();
        setErr("");

        const required = [
            ["title", "Title"],
            ["artist", "Artist"],
            ["date", "Date"],
            ["time", "Time"],
            ["venue", "Venue"],
            ["city", "City"],
            ["image", "Poster image URL"],
            ["description", "Description"],
        ];
        const missing = required.find(([k]) => !String(form[k]).trim());
        if (missing) {
            setErr(`${missing[1]} is required`);
            return;
        }

        const payload = {
            ...form,
            date: fmtDate(form.date),
            time: fmtTime(form.time),
            tiers: form.tiers.map((t) => ({
                ...t,
                perks: t.perks
                    .split(/[,\n]/)
                    .map((p) => p.trim())
                    .filter(Boolean),
            })),
            gallery: form.gallery.map((g) => g.trim()).filter(Boolean),
        };

        setSaving(true);
        try {
            const { data } = await api.post("/events", payload);
            toast.success("Event created");
            nav(`/events/${data.id}`);
        } catch (e2) {
            const msg = formatErr(e2.response?.data?.detail) || e2.message;
            setErr(msg);
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (authLoading) {
        return (
            <AppShell>
                <div className="p-10 text-white/60">Loading…</div>
            </AppShell>
        );
    }

    if (!user) {
        return (
            <AppShell>
                <div className="max-w-md mx-auto px-5 py-20 text-center">
                    <h1 className="font-display text-3xl font-bold">
                        Sign in to create an event
                    </h1>
                    <p className="font-body text-white/60 mt-3">
                        You need an account to publish events on Bash.
                    </p>
                    <Link
                        href="/login?next=/create-event"
                        data-testid="create-event-login"
                        className="inline-block mt-6 px-6 py-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 font-display font-semibold"
                    >
                        Sign in
                    </Link>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell>
            <form
                onSubmit={submit}
                data-testid="create-event-form"
                className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-10"
            >
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
                        Create event
                    </h1>
                    <p className="font-body text-white/60 mt-2 mb-8">
                        Fill in the details below. Your event appears on the home page as
                        soon as you publish.
                    </p>
                </motion.div>

                {/* Basics */}
                <Card title="Basics">
                    <Field label="Event title *">
                        <input
                            className={inputCls}
                            data-testid="ev-title"
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            placeholder="Coldplay — Music of the Spheres"
                        />
                    </Field>
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Headline artist *">
                            <input
                                className={inputCls}
                                data-testid="ev-artist"
                                value={form.artist}
                                onChange={(e) => set("artist", e.target.value)}
                            />
                        </Field>
                        <Field label="Subtitle">
                            <input
                                className={inputCls}
                                data-testid="ev-subtitle"
                                value={form.subtitle}
                                onChange={(e) => set("subtitle", e.target.value)}
                                placeholder="World Tour"
                            />
                        </Field>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Genre *">
                            <select
                                className={inputCls}
                                data-testid="ev-genre"
                                value={form.genre}
                                onChange={(e) => set("genre", e.target.value)}
                            >
                                {GENRES.map((g) => (
                                    <option key={g.slug} value={g.name} className="bg-[#111827]">
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <label className="flex items-center gap-3 mt-7 font-body text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                data-testid="ev-live"
                                checked={form.is_live}
                                onChange={(e) => set("is_live", e.target.checked)}
                                className="w-5 h-5 accent-purple-500"
                            />
                            Show the LIVE badge
                        </label>
                    </div>
                    <Field label="Description *">
                        <textarea
                            rows={4}
                            className={inputCls}
                            data-testid="ev-description"
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)}
                            placeholder="What should guests expect?"
                        />
                    </Field>
                </Card>

                {/* When & where */}
                <Card title="Date, time & venue">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Field label="Date *">
                            <input
                                type="date"
                                className={inputCls}
                                data-testid="ev-date"
                                value={form.date}
                                onChange={(e) => set("date", e.target.value)}
                            />
                        </Field>
                        <Field label="Start time *">
                            <input
                                type="time"
                                className={inputCls}
                                data-testid="ev-time"
                                value={form.time}
                                onChange={(e) => set("time", e.target.value)}
                            />
                        </Field>
                        <Field label="Venue *">
                            <input
                                className={inputCls}
                                data-testid="ev-venue"
                                value={form.venue}
                                onChange={(e) => set("venue", e.target.value)}
                            />
                        </Field>
                        <Field label="City *">
                            <input
                                className={inputCls}
                                data-testid="ev-city"
                                list="city-suggestions"
                                value={form.city}
                                onChange={(e) => set("city", e.target.value)}
                            />
                            <datalist id="city-suggestions">
                                {["Mumbai", "Pune", "Delhi", "Goa", "Chandigarh", "Bangalore", "Hyderabad"].map(
                                    (c) => (
                                        <option key={c} value={c} />
                                    ),
                                )}
                            </datalist>
                        </Field>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                        <Field label="Age limit">
                            <input
                                className={inputCls}
                                value={form.info.age_limit}
                                onChange={(e) => setNested("info", "age_limit", e.target.value)}
                                placeholder="18+"
                            />
                        </Field>
                        <Field label="Doors open">
                            <input
                                className={inputCls}
                                value={form.info.doors_open}
                                onChange={(e) => setNested("info", "doors_open", e.target.value)}
                                placeholder="6:30 PM"
                            />
                        </Field>
                        <Field label="Duration">
                            <input
                                className={inputCls}
                                value={form.info.duration}
                                onChange={(e) => setNested("info", "duration", e.target.value)}
                                placeholder="Approx. 4 hrs"
                            />
                        </Field>
                    </div>
                </Card>

                {/* Images */}
                <Card title="Images" subtitle="Use direct image links (https://…).">
                    <Field label="Poster image URL *">
                        <input
                            className={inputCls}
                            data-testid="ev-image"
                            value={form.image}
                            onChange={(e) => set("image", e.target.value)}
                            placeholder="https://…"
                        />
                    </Field>
                    <Field label="Hero image URL (optional, defaults to poster)">
                        <input
                            className={inputCls}
                            value={form.hero_image}
                            onChange={(e) => set("hero_image", e.target.value)}
                            placeholder="https://…"
                        />
                    </Field>
                    {/^https?:\/\//i.test(form.image) && (
                        <img
                            src={resizeImg(form.image, 600)}
                            alt="Poster preview"
                            className="h-40 rounded-2xl object-cover border border-white/10"
                        />
                    )}
                </Card>

                {/* Tiers */}
                <Card title="Ticket tiers" subtitle="Tier names must be unique. Up to 6 tiers.">
                    {form.tiers.map((t, i) => (
                        <div
                            key={i}
                            data-testid={`tier-row-${i}`}
                            className="rounded-2xl border border-white/10 p-4 space-y-3"
                        >
                            <div className="grid grid-cols-2 md:grid-cols-[1fr_140px_1fr] gap-3">
                                <input
                                    className={inputCls}
                                    placeholder="Tier name"
                                    data-testid={`tier-name-${i}`}
                                    value={t.name}
                                    onChange={(e) => setRow("tiers", i, "name", e.target.value)}
                                />
                                <input
                                    className={inputCls}
                                    type="number"
                                    min="1"
                                    placeholder="Price (₹)"
                                    data-testid={`tier-price-${i}`}
                                    value={t.price}
                                    onChange={(e) => setRow("tiers", i, "price", e.target.value)}
                                />
                                <input
                                    className={`${inputCls} col-span-2 md:col-span-1`}
                                    placeholder="Note (e.g. Standing)"
                                    value={t.note}
                                    onChange={(e) => setRow("tiers", i, "note", e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3">
                                <input
                                    className={inputCls}
                                    placeholder="Perks, separated by commas"
                                    value={t.perks}
                                    onChange={(e) => setRow("tiers", i, "perks", e.target.value)}
                                />
                                <RemoveButton
                                    onClick={() => removeRow("tiers", i)}
                                    disabled={form.tiers.length === 1}
                                />
                            </div>
                        </div>
                    ))}
                    {form.tiers.length < 6 && (
                        <AddButton
                            testid="add-tier"
                            onClick={() =>
                                addRow("tiers", { name: "", price: "", note: "", perks: "" })
                            }
                        >
                            Add tier
                        </AddButton>
                    )}
                </Card>

                {/* Lineup */}
                <Card
                    title="Artist lineup"
                    subtitle="Artists without a photo get an initials avatar."
                >
                    {form.lineup.map((l, i) => (
                        <div
                            key={i}
                            data-testid={`lineup-row-${i}`}
                            className="rounded-2xl border border-white/10 p-4 space-y-3"
                        >
                            <div className="grid grid-cols-2 md:grid-cols-[1fr_160px_130px] gap-3">
                                <input
                                    className={`${inputCls} col-span-2 md:col-span-1`}
                                    placeholder="Artist name"
                                    data-testid={`lineup-name-${i}`}
                                    value={l.name}
                                    onChange={(e) => setRow("lineup", i, "name", e.target.value)}
                                />
                                <select
                                    className={inputCls}
                                    value={l.role}
                                    onChange={(e) => setRow("lineup", i, "role", e.target.value)}
                                >
                                    {LINEUP_ROLES.map((r) => (
                                        <option key={r} value={r} className="bg-[#111827]">
                                            {r}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    className={inputCls}
                                    placeholder="Set time"
                                    value={l.set_time}
                                    onChange={(e) => setRow("lineup", i, "set_time", e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3">
                                <input
                                    className={inputCls}
                                    placeholder="Photo URL (optional)"
                                    value={l.photo}
                                    onChange={(e) => setRow("lineup", i, "photo", e.target.value)}
                                />
                                <RemoveButton
                                    onClick={() => removeRow("lineup", i)}
                                    disabled={form.lineup.length === 1}
                                />
                            </div>
                        </div>
                    ))}
                    {form.lineup.length < 20 && (
                        <AddButton
                            testid="add-artist"
                            onClick={() =>
                                addRow("lineup", {
                                    name: "",
                                    role: "Support",
                                    set_time: "",
                                    photo: "",
                                })
                            }
                        >
                            Add artist
                        </AddButton>
                    )}
                </Card>

                {/* Gallery */}
                <Card title="Gallery" subtitle="Add up to 12 image links.">
                    {form.gallery.map((g, i) => (
                        <div key={i} className="flex items-center gap-3">
                            {/^https?:\/\//i.test(g) && (
                                <img
                                    src={resizeImg(g, 120)}
                                    alt=""
                                    className="w-10 h-10 rounded-lg object-cover border border-white/10"
                                />
                            )}
                            <input
                                className={inputCls}
                                placeholder="https://…"
                                data-testid={`gallery-url-${i}`}
                                value={g}
                                onChange={(e) => setRow("gallery", i, null, e.target.value)}
                            />
                            <RemoveButton
                                onClick={() => removeRow("gallery", i)}
                                disabled={form.gallery.length === 1}
                            />
                        </div>
                    ))}
                    {form.gallery.length < 12 && (
                        <AddButton testid="add-photo" onClick={() => addRow("gallery", "")}>
                            Add photo
                        </AddButton>
                    )}
                </Card>

                {/* FAQ */}
                <Card title="FAQ" subtitle="Answer the questions guests ask most.">
                    {form.faqs.map((f, i) => (
                        <div
                            key={i}
                            data-testid={`faq-row-${i}`}
                            className="rounded-2xl border border-white/10 p-4 space-y-3"
                        >
                            <input
                                className={inputCls}
                                placeholder="Question"
                                value={f.q}
                                onChange={(e) => setRow("faqs", i, "q", e.target.value)}
                            />
                            <div className="flex gap-3">
                                <textarea
                                    rows={2}
                                    className={inputCls}
                                    placeholder="Answer"
                                    value={f.a}
                                    onChange={(e) => setRow("faqs", i, "a", e.target.value)}
                                />
                                <RemoveButton
                                    onClick={() => removeRow("faqs", i)}
                                    disabled={form.faqs.length === 1}
                                />
                            </div>
                        </div>
                    ))}
                    {form.faqs.length < 12 && (
                        <AddButton
                            testid="add-faq"
                            onClick={() => addRow("faqs", { q: "", a: "" })}
                        >
                            Add question
                        </AddButton>
                    )}
                </Card>

                {/* Location */}
                <Card
                    title="Location"
                    subtitle="The map is built from the address. Leave it blank to use venue + city."
                >
                    <Field label="Full address">
                        <input
                            className={inputCls}
                            data-testid="ev-address"
                            value={form.location.address}
                            onChange={(e) => setNested("location", "address", e.target.value)}
                        />
                    </Field>
                    <Field label="Getting there">
                        <textarea
                            rows={2}
                            className={inputCls}
                            value={form.location.getting_there}
                            onChange={(e) => setNested("location", "getting_there", e.target.value)}
                        />
                    </Field>
                    <Field label="Parking">
                        <input
                            className={inputCls}
                            value={form.location.parking}
                            onChange={(e) => setNested("location", "parking", e.target.value)}
                        />
                    </Field>
                </Card>

                {err && (
                    <div
                        data-testid="create-event-error"
                        className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-body text-sm text-red-200"
                    >
                        {err}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={saving}
                    data-testid="submit-event-btn"
                    className="w-full rounded-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 font-display font-semibold text-white hover:scale-[1.01] disabled:opacity-60 transition shadow-lg shadow-purple-900/40 flex items-center justify-center gap-2"
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? "Publishing…" : "Publish event"}
                </button>
            </form>
        </AppShell>
    );
}
