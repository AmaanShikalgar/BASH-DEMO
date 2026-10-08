// Shared (client + server) event constants and validation.

export const GENRES = [
    { slug: "pop", name: "Pop" },
    { slug: "rock", name: "Rock" },
    { slug: "edm", name: "EDM" },
    { slug: "hiphop", name: "Hip Hop" },
    { slug: "techno", name: "Techno" },
    { slug: "classical", name: "Classical" },
];

export const LINEUP_ROLES = [
    "Headliner",
    "Support",
    "Opening act",
    "Special guest",
];

export const slugify = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const isUrl = (v) => /^https?:\/\/\S+$/i.test(v);
const DATE_RE = /^\d{1,2} [A-Za-z]+ \d{4}$/; // "17 March 2026"
const TIME_RE = /^\d{1,2}:\d{2} (AM|PM)$/; // "7:00 PM"

const list = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

/**
 * Validates + cleans a create-event payload.
 * Returns { event } (without id/created_at) or { errors: string[] }.
 */
export function normalizeEvent(raw = {}) {
    const errors = [];

    const title = str(raw.title, 120);
    const artist = str(raw.artist, 120);
    const subtitle = str(raw.subtitle, 160);
    const description = str(raw.description, 2000);
    const city = str(raw.city, 60);
    const venue = str(raw.venue, 160);
    const date = str(raw.date, 40);
    const time = str(raw.time, 20);
    const image = str(raw.image, 1000);
    const hero = str(raw.hero_image, 1000);
    const genre = GENRES.find(
        (g) => g.name === raw.genre || g.slug === raw.genre_slug,
    );

    if (!title) errors.push("Title is required");
    if (!artist) errors.push("Artist is required");
    if (!genre) errors.push("Pick a valid genre");
    if (!city) errors.push("City is required");
    if (!venue) errors.push("Venue is required");
    if (!DATE_RE.test(date)) errors.push("Date is required");
    if (!TIME_RE.test(time)) errors.push("Time is required");
    if (!isUrl(image)) errors.push("Poster image must be a valid http(s) URL");
    if (hero && !isUrl(hero)) errors.push("Hero image must be a valid http(s) URL");
    if (description.length < 10)
        errors.push("Description must be at least 10 characters");

    // Tiers (names must be unique because bookings look tiers up by name)
    const tiers = [];
    const seen = new Set();
    for (const t of list(raw.tiers, 6)) {
        const name = str(t?.name, 40);
        const price = Number(t?.price);
        if (!name && !t?.price) continue;
        if (!name) {
            errors.push("Every ticket tier needs a name");
            continue;
        }
        if (!Number.isFinite(price) || price <= 0) {
            errors.push(`Tier "${name}" needs a price above 0`);
            continue;
        }
        if (seen.has(name.toLowerCase())) {
            errors.push(`Tier name "${name}" is used twice`);
            continue;
        }
        seen.add(name.toLowerCase());
        const perks = list(
            Array.isArray(t.perks) ? t.perks : [],
            8,
        )
            .map((p) => str(p, 80))
            .filter(Boolean);
        tiers.push({
            name,
            price: Math.round(price),
            note: str(t.note, 60),
            perks,
        });
    }
    if (tiers.length === 0) errors.push("Add at least one ticket tier");

    const lineup = list(raw.lineup, 20)
        .map((l) => {
            const photo = str(l?.photo, 1000);
            return {
                name: str(l?.name, 80),
                role: str(l?.role, 40) || "Support",
                set_time: str(l?.set_time, 20),
                photo: isUrl(photo) ? photo : "",
            };
        })
        .filter((l) => l.name);

    const gallery = list(raw.gallery, 12)
        .map((u) => str(u, 1000))
        .filter(isUrl);

    const faqs = list(raw.faqs, 12)
        .map((f) => ({ q: str(f?.q, 200), a: str(f?.a, 1000) }))
        .filter((f) => f.q && f.a);

    const loc = raw.location || {};
    const location = {
        address: str(loc.address, 240) || `${venue}, ${city}`,
        getting_there: str(loc.getting_there, 500),
        parking: str(loc.parking, 300),
    };

    const inf = raw.info || {};
    const info = {
        age_limit: str(inf.age_limit, 60),
        doors_open: str(inf.doors_open, 30),
        duration: str(inf.duration, 40),
    };

    if (errors.length) return { errors };

    return {
        event: {
            title,
            artist,
            subtitle,
            genre: genre.name,
            genre_slug: genre.slug,
            city,
            city_slug: slugify(city),
            venue,
            date,
            time,
            image,
            hero_image: hero || image,
            description,
            is_live: Boolean(raw.is_live),
            tiers,
            lineup,
            gallery: gallery.length ? gallery : [image],
            reviews: [],
            faqs,
            location,
            info,
        },
    };
}
