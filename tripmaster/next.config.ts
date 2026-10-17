import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['mapbox-gl'],

  // Heavy CJS parsers used only in server routes (document extraction) — keep them
  // out of the bundle and require them at runtime from node_modules.
  serverExternalPackages: ['xlsx', 'mammoth'],

  // Stamped onto the service worker URL (src/lib/offline/sw.ts) so every deploy installs
  // a fresh worker with its own offline caches. A timestamp so builds compare by age.
  env: {
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
