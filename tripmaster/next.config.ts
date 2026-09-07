import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['mapbox-gl'],

  // Heavy CJS parsers used only in server routes (document extraction) — keep them
  // out of the bundle and require them at runtime from node_modules.
  serverExternalPackages: ['xlsx', 'mammoth'],
};

export default nextConfig;
