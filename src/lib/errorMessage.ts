import type { AxiosError } from "axios";

// Single place every page/component should go through to turn a caught error
// into user-facing text. Never surfaces err.message directly for non-Axios
// errors (could be a raw JS/runtime error exposing internal details) and
// only trusts the `message` field the backend explicitly put in its JSON
// envelope — never a raw response body, stack trace, or status text.
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  const axiosErr = err as AxiosError<{ message?: string }>;
  if (axiosErr?.isAxiosError) {
    return axiosErr.response?.data?.message || fallback;
  }
  return fallback;
}
