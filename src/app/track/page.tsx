"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { normalizePkMobile, PHONE_ERROR } from "@/lib/phone";
import { to12h } from "@/lib/time";

// PUBLIC page — no login. Customers check their order status with just the
// phone number they gave the shop. Backed by GET /api/public/orders, which
// returns only minimal fields and excludes branches that turned the
// publicStatusCheck feature off.

interface PublicOrder {
  orderNumber: string;
  suitNo?: string;
  status: string;
  promisedDate?: string;
  isPickedUp?: boolean;
  balanceDue?: number;
  branch?: string;
  createdAt?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Received",
  received: "Received",
  cutting: "In Progress — Cutting",
  cutting_review: "In Progress — Cutting",
  stitching: "In Progress — Stitching",
  stitching_review: "In Progress — Stitching",
  pressing: "In Progress — Pressing",
  pressing_review: "In Progress — Pressing",
  quality_check: "Final Check",
  ready: "Ready for Pickup 🎉",
  delivered: "Delivered ✓",
  rework: "In Progress",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  ready: "bg-green-100 text-green-700",
  delivered: "bg-gray-200 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

interface PublicAppointment {
  branch: string;
  date: string;
  time: string;
  visitTime?: string;
}

export default function TrackPage() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<PublicOrder[] | null>(null);
  const [appointments, setAppointments] = useState<PublicAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = normalizePkMobile(phone);
    if (!normalized) {
      setError(PHONE_ERROR);
      setOrders(null);
      return;
    }
    setLoading(true);
    setError("");
    setOrders(null);
    setAppointments([]);
    // Upcoming appointments ride along (appointmentLoop feature per branch);
    // failures are silent — the orders result is the main event.
    api
      .get("/public/appointments", { params: { phone: normalized } })
      .then(({ data }) => setAppointments(data.data || []))
      .catch(() => {});
    try {
      const { data } = await api.get("/public/orders", {
        params: { phone: normalized },
      });
      setOrders(data.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Something went wrong — please try again";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-white dark:from-gray-900 dark:to-gray-950 px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">
            <Link href="/">✂️ Taylor App</Link>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track your order
          </p>
        </div>

        <form
          onSubmit={search}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-3 border border-transparent dark:border-gray-800"
        >
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Your phone number
          </label>
          <div className="flex gap-2">
            <input
              className={`input flex-1 ${phone.trim() && !normalizePkMobile(phone) ? "border-red-400 focus:ring-red-400" : ""}`}
              placeholder="03XX XXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              maxLength={16}
              required
            />
            <button
              type="submit"
              disabled={loading || !normalizePkMobile(phone)}
              className="btn-primary text-sm px-4"
            >
              {loading ? "Checking…" : "Check"}
            </button>
          </div>
          {phone.trim() !== "" && !normalizePkMobile(phone) && (
            <p className="text-xs text-red-500">{PHONE_ERROR}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Use the same number you gave at the shop.
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {appointments.map((a, i) => (
          <div
            key={i}
            className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-2xl p-4 text-sm text-blue-800 dark:text-blue-300"
          >
            📅 Your appointment: <b>{a.branch}</b> —{" "}
            {new Date(`${a.date}T00:00:00`).toLocaleDateString()} at{" "}
            <b>{to12h(a.visitTime || a.time)}</b>
          </div>
        ))}

        {orders && orders.length === 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow p-6 text-center text-sm text-gray-500 dark:text-gray-400 border border-transparent dark:border-gray-800">
            No orders found for this number. Please check the number or contact
            the shop.
          </div>
        )}

        {orders &&
          orders.map((o) => (
            <div
              key={o.orderNumber}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow p-5 space-y-2 border border-transparent dark:border-gray-800"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-mono font-semibold text-gray-900 dark:text-gray-100 break-all">
                  {o.suitNo ? `Suit No ${o.suitNo}` : o.orderNumber}
                </p>
                <span
                  className={`badge ${STATUS_COLORS[o.status] || "bg-blue-100 text-blue-700"}`}
                >
                  {STATUS_LABELS[o.status] || o.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                {o.suitNo && <p className="font-mono text-xs">{o.orderNumber}</p>}
                {o.branch && <p>Branch: {o.branch}</p>}
                {o.promisedDate && (
                  <p>
                    Ready by:{" "}
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {new Date(o.promisedDate).toLocaleDateString()}
                    </span>
                  </p>
                )}
                {(o.balanceDue ?? 0) > 0 && !o.isPickedUp && (
                  <p>
                    Balance due:{" "}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      PKR {(o.balanceDue ?? 0).toLocaleString()}
                    </span>
                  </p>
                )}
                {o.isPickedUp && <p>Picked up ✓</p>}
              </div>
            </div>
          ))}

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          <Link href="/book" className="text-primary hover:underline">
            📅 Book an appointment
          </Link>
          {" · "}
          <Link href="/login" className="hover:underline">
            Staff login
          </Link>
        </p>
      </div>
    </div>
  );
}
