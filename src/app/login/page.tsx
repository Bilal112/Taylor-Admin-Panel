"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScissorsIcon, ArchiveBoxIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import type { AxiosError } from "axios";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome, ${user.name}!`);
      router.push("/dashboard");
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-accent-soft to-bg px-4">
      <div className="bg-surface rounded-2xl shadow-xl p-8 w-full max-w-md border border-border">
        <div className="text-center mb-8">
          <h1 className="flex items-center justify-center gap-2 text-3xl font-extrabold text-ink">
            <ScissorsIcon className="h-7 w-7 text-accent" aria-hidden="true" />
            Taylor App
          </h1>
          <p className="text-muted mt-1">Admin Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Email</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Password</label>
            <input
              type="password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-faint mt-6">
          <span>Customer?</span>
          <Link href="/track" className="inline-flex items-center gap-1 text-accent hover:underline">
            <ArchiveBoxIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Track your order
          </Link>
          <Link href="/book" className="inline-flex items-center gap-1 text-accent hover:underline">
            <CalendarDaysIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Book an appointment
          </Link>
        </p>
      </div>
    </div>
  );
}
