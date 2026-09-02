"use client";
import { useEffect, useState } from "react";

// "Install the app" banner for the PWA — mobile AND desktop. Chrome/Edge
// (Android and desktop alike) expose a real install flow via the
// beforeinstallprompt event; iOS Safari has no install API, so iPhones/iPads
// get the manual Share → Add to Home Screen steps instead. Browsers with no
// install support (desktop Safari/Firefox) simply never show the banner.
// Never shown inside the installed app, or again after dismissal
// (remembered per device in localStorage).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "taylor-app-install-dismissed";

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}

    // Already running as the installed app — nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      setShowIos(true);
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault(); // suppress Chrome's own mini-infobar; we render ours
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice; // accepted or not, our banner's job is done
    setInstallEvent(null);
    setVisible(false);
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  if (!visible) return null;

  return (
    <div className="no-print fixed bottom-3 inset-x-3 md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-3 flex items-center gap-3">
      <span className="text-2xl" aria-hidden="true">
        ✂️
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Install Taylor App
        </p>
        {showIos ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tap <span className="font-semibold">Share</span> →{" "}
            <span className="font-semibold">Add to Home Screen</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Quick access from your home screen
          </p>
        )}
      </div>
      {!showIos && installEvent && (
        <button
          onClick={install}
          className="btn-primary text-xs px-3 py-1.5 shrink-0"
        >
          Install
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-gray-400 dark:text-gray-500 p-1 shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
