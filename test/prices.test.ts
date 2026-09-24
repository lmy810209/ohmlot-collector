import { test } from "node:test";
import assert from "node:assert/strict";
import sources from "../config/price-sources.json" with { type: "json" };
import { sourceId } from "../src/prices.ts";

test("sourceId: stable, filesystem-safe, and unique across every configured source", () => {
  const ids = (sources as { seller: string; url: string }[]).map(sourceId);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9-]+__[a-z0-9-]+$/, `not filesystem-safe: ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, `duplicate source ids: ${ids.join(", ")}`);
});

test("sourceId: strips extension and query string, keeps the product handle", () => {
  assert.equal(sourceId({ seller: "unitree-official", url: "https://shop.unitree.com/products/unitree-go2.js" }), "unitree-official__unitree-go2");
  assert.equal(sourceId({ seller: "unitree-official", url: "https://shop.unitree.com/products/unitree-go2.js?country=US" }), "unitree-official__unitree-go2");
  assert.equal(sourceId({ seller: "keyi-official", url: "https://us.keyirobot.com/products/petbot.json" }), "keyi-official__petbot");
  assert.equal(sourceId({ seller: "1x-official", url: "https://www.1x.tech/order" }), "1x-official__order");
});
