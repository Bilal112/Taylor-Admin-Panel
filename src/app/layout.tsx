import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
