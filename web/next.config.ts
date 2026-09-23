import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Two lockfiles exist (repo root + web/); pin the Turbopack root to this app so it doesn't guess.
  turbopack: { root: process.cwd() },
};

export default nextConfig;
