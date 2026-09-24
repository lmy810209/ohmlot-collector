import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export const UA =
  process.env.COLLECTOR_UA ??
  "OhmlotBot/0.1 (+https://ohmlot.com; daily list-price snapshot)";

export const todayUTC = () => new Date().toISOString().slice(0, 10);
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url: string, tries = 3): Promise<string> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "*/*" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return await res.text();
      const cf = res.headers.get("cf-mitigated"); // "challenge" = Cloudflare bot check
      last = new Error(`HTTP ${res.status}${cf ? ` (cloudflare ${cf})` : ""} ${url}`);
      // A 4xx (other than 429) won't change on retry: bot challenge, geo-block, or a moved product handle.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (e) {
      last = e;
    }
    if (i < tries - 1) await sleep(2000 * (i + 1));
  }
  throw last;
}

/** Same retry/error policy as fetchText, for a binary body (PDFs). */
export async function fetchBinary(url: string, tries = 3): Promise<Uint8Array> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "application/pdf,*/*" },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      const cf = res.headers.get("cf-mitigated");
      last = new Error(`HTTP ${res.status}${cf ? ` (cloudflare ${cf})` : ""} ${url}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (e) {
      last = e;
    }
    if (i < tries - 1) await sleep(2000 * (i + 1));
  }
  throw last;
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

/** Byte-for-byte archive of a response body (no re-serialization). */
export async function writeText(path: string, text: string) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}

export async function writeJsonl(path: string, rows: unknown[]) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
}

export async function appendLog(path: string, line: string) {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, line + "\n");
}
