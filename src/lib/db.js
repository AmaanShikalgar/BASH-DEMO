// Tiny JSON-file persistence helpers (server only). Data lives in ./data/*.json.
import fs from "fs/promises";
import path from "path";

const DIR = path.join(process.cwd(), "data");

export async function readJson(name, fallback) {
    try {
        return JSON.parse(await fs.readFile(path.join(DIR, name), "utf8"));
    } catch {
        return fallback;
    }
}

export async function writeJson(name, value) {
    await fs.mkdir(DIR, { recursive: true });
    const file = path.join(DIR, name);
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(value, null, 2));
    await fs.rename(tmp, file);
}

// One in-process queue per file name so read-modify-write cycles never interleave.
const queues = new Map();
export function withLock(name, fn) {
    const prev = queues.get(name) || Promise.resolve();
    const run = prev.then(fn, fn);
    queues.set(
        name,
        run.catch(() => {}),
    );
    return run;
}
