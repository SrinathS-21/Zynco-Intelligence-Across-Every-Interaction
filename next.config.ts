import type { NextConfig } from "next";
import path from "node:path";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  // Isolate dev and prod build outputs to prevent manifest/chunk races
  // when dev server and production build run in parallel terminals.
  distDir: isDevelopment ? ".next-dev" : ".next",
};

export default nextConfig;
