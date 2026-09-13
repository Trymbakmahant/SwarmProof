import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static export: `next build` regenerates `out/`, which the deploy
  // scripts (deploy:web / deploy:vercel) push to Vercel. Without this the
  // deployed site silently stayed on an old build.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;