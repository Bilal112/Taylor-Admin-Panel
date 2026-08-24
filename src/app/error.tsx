"use client";
import { useEffect } from "react";

// Next.js App Router error boundary — catches any render/render-time error
// in the tree below it and shows this instead of the default Next.js dev/
// prod error screen, which can otherwise include stack traces and file
// paths. `error` is intentionally NOT rendered to the user here, only
// logged — logging it is still useful for debugging via the browser
// console during development or a session-replay tool in production.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-lg font-bold text-gray-900">
          Something went wrong
        </h1>
        <p className="text-sm text-gray-500">
          An unexpected error occurred. You can try again, or go back to the
          dashboard.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => reset()} className="btn-primary text-sm">
            Try Again
          </button>
          <a href="/dashboard" className="btn-secondary text-sm">
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
