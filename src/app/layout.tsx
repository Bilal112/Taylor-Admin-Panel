import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Public_Sans } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DialogProvider } from "@/context/DialogContext";
import InstallPrompt from "@/components/InstallPrompt";

// One typeface for the whole app, weight-differentiated (see globals.css /
// tailwind.config.js) instead of mixing fonts for emphasis.
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taylor App",
  description: "Multi-branch tailoring shop management system",
};

// Runs before React hydrates, straight from the inline <script> below, so
// the correct theme class is on <html> for the very first paint — without
// this, the page would flash light (the server-rendered default) and then
// snap to dark a moment later for anyone whose saved/system preference is
// dark. Deliberately not using next/script here: this must block render,
// which is exactly what next/script is designed to avoid.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("taylor-app-theme");
    var resolved = stored === "dark" || stored === "light" ? stored :
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (resolved === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={publicSans.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans bg-bg text-ink">
        <ThemeProvider>
          <AuthProvider>
            <DialogProvider>
              {children}
              <Toaster position="top-right" />
              <InstallPrompt />
            </DialogProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
