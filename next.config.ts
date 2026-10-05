import type { NextConfig } from "next";

// Two deployments from one codebase. The private admin application's route
// files are named *.admin.tsx (page.admin.tsx, layout.admin.tsx, ...), so they
// exist only in a build with APP_SURFACE=admin; the public site's build never
// contains them. See src/lib/admin/surface.ts.
const admin = process.env.APP_SURFACE === "admin";

const nextConfig: NextConfig = {
  pageExtensions: admin ? ["admin.tsx", "admin.ts", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
  // The admin build has its own output directory and type-check settings, so
  // the two applications' generated route types never mix (and the public site
  // and the admin demo can run side by side locally).
  ...(admin ? { distDir: ".next-admin", typescript: { tsconfigPath: "tsconfig.admin.json" } } : {}),
  experimental: {
    optimizePackageImports: ["framer-motion"],
  },
};

export default nextConfig;
