/**
 * The site's canonical origin, written once. app/layout.tsx (metadataBase, which resolves every canonical tag),
 * app/sitemap.ts and app/robots.ts all read it. The primary domain is www: ohmlot.com answers with a 308
 * redirect to it, and a sitemap, robots.txt or canonical that names a redirecting address is wrong, so none
 * of them may spell the apex domain. No trailing slash.
 */
export const SITE_URL = "https://www.ohmlot.com";
export const SITE_NAME = "Ohmlot";
