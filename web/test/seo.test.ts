import { test } from "node:test";
import assert from "node:assert/strict";
import { getModels } from "../lib/data.ts";
import { absoluteUrl, CHANGES_DESCRIPTION, CHANGES_PATH, CHANGES_TITLE, FCC_DESCRIPTION, FCC_PATH, FCC_TITLE, HOME_PATH, homeDescription, homeTitle, MAX_DESCRIPTION, MAX_TITLE, plainName, robotDescription, robotPath, robotTitle, sitemapEntries, TITLE_SUFFIX } from "../lib/seo.ts";
import { SITE_URL } from "../lib/site.ts";

// These read the real ../data catalog (cwd is web/ under `npm test`), so they double as a guard: a newly
// added model with a very long name, or a new provenance case, fails here instead of shipping a cut-off snippet.

const models = getModels();

test("plainName: drops parenthetical catalog notes, keeps the searchable name", () => {
  assert.equal(plainName("Vector 2.0 (orig. Anki Vector)"), "Vector 2.0");
  assert.equal(plainName("SO-101 (SO-ARM101) arm kit"), "SO-101 arm kit");
  assert.equal(plainName("Unitree Go1 (Air/Pro/Edu)"), "Unitree Go1");
  assert.equal(plainName("Reachy 2"), "Reachy 2");
});

test("every robot title fits in a search result and names the robot", () => {
  for (const m of models) {
    const t = robotTitle(m);
    assert.ok(t.length + TITLE_SUFFIX.length <= MAX_TITLE, `${m.id}: "${t}" is ${t.length + TITLE_SUFFIX.length} chars with suffix`);
    assert.ok(t.startsWith(plainName(m.name)), `${m.id}: title should lead with the product name`);
    assert.ok(/price/i.test(t), `${m.id}: title should carry the word "price"`);
  }
});

test("every robot description fits in a snippet and is unique", () => {
  const seen = new Set<string>();
  for (const m of models) {
    const d = robotDescription(m);
    assert.ok(d.length <= MAX_DESCRIPTION, `${m.id}: ${d.length} chars — "${d}"`);
    assert.ok(d.length >= 60, `${m.id}: too thin to be a useful snippet — "${d}"`);
    assert.ok(!seen.has(d), `${m.id}: duplicate description`);
    seen.add(d);
  }
});

test("titles are unique across all 32 pages plus the fixed pages", () => {
  const titles = [...models.map(robotTitle), CHANGES_TITLE, FCC_TITLE];
  assert.equal(new Set(titles).size, titles.length);
});

test("a press/unknown-provenance price never appears in a description (task-prelaunch.md §A.2)", () => {
  const unverified = models.filter((m) => (m.price_provenance === "press" || m.price_provenance === "unknown") && m.tracking_status !== "tracked");
  assert.ok(unverified.length > 0, "fixture sanity: the catalog should still contain unverified-price robots");
  for (const m of unverified) {
    const d = robotDescription(m);
    assert.ok(!d.includes("$"), `${m.id}: "${d}" quotes a dollar figure it can't stand behind`);
  }
});

test("a description only claims 'checked daily' for a robot the collector actually has rows for", () => {
  for (const m of models) {
    const claimsDaily = /checked daily/.test(robotDescription(m));
    assert.equal(claimsDaily, m.tracking_status === "tracked", `${m.id}: tracking_status=${m.tracking_status}`);
  }
});

test("home, changes and fcc copy fit their limits", () => {
  assert.ok(homeTitle().length <= MAX_TITLE, homeTitle());
  assert.ok(homeDescription().length <= MAX_DESCRIPTION, homeDescription());
  assert.ok(CHANGES_TITLE.length + TITLE_SUFFIX.length <= MAX_TITLE);
  assert.ok(CHANGES_DESCRIPTION.length <= MAX_DESCRIPTION, `${CHANGES_DESCRIPTION.length}`);
  assert.ok(FCC_TITLE.length + TITLE_SUFFIX.length <= MAX_TITLE);
  assert.ok(FCC_DESCRIPTION.length <= MAX_DESCRIPTION, `${FCC_DESCRIPTION.length}`);
});

test("sitemap: home, /changes, /fcc and every robot — and nothing else", () => {
  const urls = sitemapEntries().map((e) => e.url);
  assert.equal(urls.length, 3 + models.length);
  assert.equal(new Set(urls).size, urls.length, "no duplicate URLs");
  for (const path of [HOME_PATH, CHANGES_PATH, FCC_PATH]) assert.ok(urls.includes(absoluteUrl(path)), path);
  for (const m of models) assert.ok(urls.includes(absoluteUrl(robotPath(m.id))), m.id);
  assert.ok(!urls.some((u) => u.includes("unsubscribe")), "/unsubscribe is noindex, so it stays out of the sitemap");
});

test("sitemap: lastModified is a real YYYY-MM-DD date or absent — never invented", () => {
  for (const e of sitemapEntries()) {
    if (e.lastModified !== undefined) assert.match(e.lastModified, /^\d{4}-\d{2}-\d{2}$/, e.url);
  }
});

test("SITE_URL is the www origin — the apex domain 308-redirects to it, so no sitemap/robots/canonical URL may use the apex", () => {
  assert.equal(SITE_URL, "https://www.ohmlot.com");
  assert.ok(!SITE_URL.endsWith("/"), "no trailing slash: paths are appended with a leading slash");
  for (const e of sitemapEntries()) {
    assert.ok(e.url === SITE_URL || e.url.startsWith(`${SITE_URL}/`), `${e.url} is not under ${SITE_URL}`);
    assert.ok(!e.url.startsWith("https://ohmlot.com"), `${e.url} names the redirecting apex domain`);
  }
});

test("absoluteUrl: home is the bare origin (what Next writes into its canonical tag), everything else is origin + path", () => {
  assert.equal(absoluteUrl(HOME_PATH), SITE_URL);
  assert.equal(absoluteUrl(robotPath("unitree-g1")), `${SITE_URL}/robots/unitree-g1`);
});
