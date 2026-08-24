/** @type {import('next').NextConfig} */

// Security headers applied to every response. This is a pure client app that
// talks to a separate API origin (NEXT_PUBLIC_API_URL) — no inline scripts of
// our own beyond what Next.js itself injects, so the CSP stays fairly strict.
// 'unsafe-inline' on style-src is required because Tailwind + a few libraries
// (react-hot-toast) inject inline styles at runtime; there's no inline
// <script> requirement so script-src stays locked to 'self' in production.
//
// Dev-only: Next's dev server hot-reload runtime (react-refresh) evaluates
// code via eval()/new Function() to apply fast-refresh updates without a
// full page reload — that's blocked by a strict script-src and throws
// "Evaluating a string as JavaScript violates ... script-src". This is a
// dev-tooling requirement, not something the app itself needs, so
// 'unsafe-eval' is added only when NODE_ENV !== 'production'. A production
// build never hits this codepath.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self' https:${isDev ? " http://localhost:* ws://localhost:*" : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Don't leak framework details in the response header.
  poweredByHeader: false,
};

module.exports = nextConfig;
