import Link from "next/link";
import { ScissorsIcon, ArchiveBoxIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

// Public landing page — the default route. Customers self-serve from here
// (order tracking, appointment booking); staff continue via the login link
// to the admin panel (/login → /dashboard). Replaces the old hard redirect
// to /dashboard, which sent every visitor to the staff login.
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-accent-soft to-bg flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="flex items-center justify-center gap-2 text-4xl font-extrabold text-ink">
            <ScissorsIcon className="h-9 w-9 text-accent" aria-hidden="true" />
            Taylor App
          </h1>
          <p className="text-muted mt-2">
            Tailoring made simple — track your order or book a visit.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/track"
            className="block bg-surface rounded-2xl shadow-xl border border-border p-6 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            <ArchiveBoxIcon className="h-8 w-8 text-accent mx-auto" aria-hidden="true" />
            <span className="block mt-2 text-lg font-semibold text-ink">
              Track your order
            </span>
            <span className="block text-sm text-muted mt-1">
              Check your order status with your phone number
            </span>
          </Link>

          <Link
            href="/book"
            className="block bg-surface rounded-2xl shadow-xl border border-border p-6 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            <CalendarDaysIcon className="h-8 w-8 text-accent mx-auto" aria-hidden="true" />
            <span className="block mt-2 text-lg font-semibold text-ink">
              Book an appointment
            </span>
            <span className="block text-sm text-muted mt-1">
              Pick a branch, day and time — we&apos;ll hold your spot
            </span>
          </Link>
        </div>

        <p className="text-xs text-faint">
          Shop staff?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in to the admin panel
          </Link>
        </p>
      </div>
    </div>
  );
}
