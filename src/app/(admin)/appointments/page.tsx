"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { hasFeature } from "@/lib/features";
import { waLink } from "@/lib/whatsapp";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/types/user";
import { to12h } from "@/lib/time";

// Mirrors the response of GET /api/appointments — each booking plus whether
// the booker already exists as a customer of the branch (matched by phone),
// with their latest order for quick context.
interface AppointmentRow {
  _id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  visitTime?: string;
  status: "booked" | "completed" | "cancelled";
  branch: { _id: string; name: string } | string;
  customer: { _id: string; name: string } | null;
  latestOrder: { orderNumber: string; suitNo?: string; status: string } | null;
}

const STATUS_BADGES: Record<AppointmentRow["status"], string> = {
  booked: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const day = (d: Date) => d.toLocaleDateString("en-CA");

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [date, setDate] = useState(() => day(new Date()));
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get("/branches")
      .then(({ data }) => setBranches(data.data))
      .catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/appointments", {
        params: { date, ...(branchId ? { branch: branchId } : {}) },
      })
      .then(({ data }) => setRows(data.data))
      .catch((err) =>
        toast.error(errorMessage(err, "Failed to load appointments")),
      )
      .finally(() => setLoading(false));
  }, [date, branchId]);

  useEffect(load, [load]);

  const setStatus = async (row: AppointmentRow, status: AppointmentRow["status"]) => {
    try {
      await api.put(`/appointments/${row._id}`, { status });
      setRows((list) =>
        list.map((r) => (r._id === row._id ? { ...r, status } : r)),
      );
      toast.success(status === "cancelled" ? "Appointment cancelled" : "Marked as completed");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update appointment"));
    }
  };

  const booked = rows.filter((r) => r.status === "booked").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Appointments
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setDate(day(new Date()))}
            className="btn-secondary text-xs"
          >
            Today
          </button>
          <button
            onClick={() => setDate(day(new Date(Date.now() + 86400000)))}
            className="btn-secondary text-xs"
          >
            Tomorrow
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Date
          </label>
          <input
            type="date"
            className="input text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {isSuperAdmin && (
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Branch
            </label>
            <select
              className="input text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 pb-2">
          {booked} booked
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 dark:text-gray-500">
          No appointments for this day
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400 dark:text-gray-500">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  {isSuperAdmin && !branchId && <th className="px-4 py-3">Branch</th>}
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className={`border-t border-gray-100 dark:border-gray-800 ${
                      r.status === "cancelled" ? "opacity-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {to12h(r.visitTime || r.time)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                      {r.phone}
                    </td>
                    {isSuperAdmin && !branchId && (
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {(typeof r.branch === "object" && r.branch?.name) || "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {r.customer ? (
                        <div>
                          <span className="badge bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                            Existing: {r.customer.name}
                          </span>
                          {r.latestOrder && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {r.latestOrder.suitNo
                                ? `Suit No ${r.latestOrder.suitNo}`
                                : r.latestOrder.orderNumber}{" "}
                              · {r.latestOrder.status?.replace(/_/g, " ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="badge bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                          New customer
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_BADGES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.status === "booked" && (
                        <>
                          {hasFeature(user, "appointmentLoop") && (
                            <>
                              {/* Booking -> order in two taps: New Order opens
                                  with this phone already looked up. */}
                              <Link
                                href={`/orders/new?phone=${encodeURIComponent(r.phone)}`}
                                className="text-xs text-primary font-medium hover:underline"
                              >
                                Start Order
                              </Link>
                              <a
                                href={waLink(
                                  r.phone,
                                  `Reminder: your appointment at ${
                                    (typeof r.branch === "object" && r.branch?.name) || "our shop"
                                  } is on ${r.date} at ${to12h(r.visitTime || r.time)}.`,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-3 text-xs text-green-600 dark:text-green-400 hover:underline"
                              >
                                💬 Remind
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => setStatus(r, "completed")}
                            className={`text-xs text-green-600 dark:text-green-400 hover:underline ${
                              hasFeature(user, "appointmentLoop") ? "ml-3" : ""
                            }`}
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => setStatus(r, "cancelled")}
                            className="ml-3 text-xs text-red-500 dark:text-red-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Booking hours, slots per hour, and the on/off switch are on the
        Settings page.
      </p>
    </div>
  );
}
