import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Everything public is crawlable. /unsubscribe is kept out of search with a noindex tag on the page itself,
// not a Disallow here: a blocked URL can't be fetched, so the crawler would never see the noindex.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
