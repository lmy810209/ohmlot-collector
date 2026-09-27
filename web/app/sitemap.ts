import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo";

// Built statically with the rest of the site (the data it reads only changes when the collector commits).
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
