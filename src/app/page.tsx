import Link from "next/link";

// Public landing page — the default route. Customers self-serve from here
// (order tracking, appointment booking); staff continue via the login link
// to the admin panel (/login → /dashboard). Replaces the old hard redirect
// to /dashboard, which sent every visitor to the staff login.
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-bold text-primary">✂️ Taylor App</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Tailoring made simple — track your order or book a visit.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/track"
            className="block bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-transparent dark:border-gray-800 p-6 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            <span className="text-3xl" aria-hidden="true">
              📦
            </span>
            <span className="block mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Track your order
            </span>
            <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
              Check your order status with your phone number
            </span>
          </Link>

          <Link
            href="/book"
            className="block bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-transparent dark:border-gray-800 p-6 hover:shadow-2xl hover:-translate-y-0.5 transition-all"
          >
            <span className="text-3xl" aria-hidden="true">
              📅
            </span>
            <span className="block mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Book an appointment
            </span>
            <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
              Pick a branch, day and time — we&apos;ll hold your spot
            </span>
          </Link>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500">
          Shop staff?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in to the admin panel
          </Link>
        </p>
      </div>
    </div>
  );
}
