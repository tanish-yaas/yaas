import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // PDFKit reads its font metrics off disk relative to its own files, which a
  // bundler would move. Left as a plain node_modules require instead.
  serverExternalPackages: ["pdfkit"],

  // The report PDF embeds Geist from src/server/reports/fonts, read with fs at
  // request time. Nothing imports those files, so the tracer has to be told to
  // ship them with the export route or it 500s on Vercel and works locally.
  outputFileTracingIncludes: {
    "/w/*/reports/export": ["./src/server/reports/fonts/*.ttf"],
  },

  experimental: {
    // Attachments post through a server action; the default cap is 1 MB.
    serverActions: { bodySizeLimit: "12mb" },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // microphone=(self), not microphone=(). An empty allowlist blocks
            // the feature for our own origin too, and the browser then refuses
            // getUserMedia *without prompting* — by design, since the site has
            // said it does not want the capability. That reads exactly like a
            // user-denied permission with no way to grant it. Voice notes need
            // this; camera and geolocation stay closed because nothing uses them.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;