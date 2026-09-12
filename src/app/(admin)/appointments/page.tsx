"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { hasFeature } from "@/lib/features";
import { waLink } from "@/lib/whatsapp";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
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

const STATUS_BADGE: Record<AppointmentRow["status"], string> = {
  booked: "badge-accent",
  completed: "badge-success",
  cancelled: "badge-neutral",
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
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
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
          <label className="block text-xs font-semibold text-ink mb-1">
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
            <label className="block text-xs font-semibold text-ink mb-1">
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
        <p className="text-sm text-muted pb-2">
          {booked} booked
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-faint">
          No appointments for this day
        </div>
      ) : (
        <div className="table-wrap">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Name</th>
                  <th>Phone</th>
                  {isSuperAdmin && !branchId && <th>Branch</th>}
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    className={r.status === "cancelled" ? "opacity-50" : ""}
                  >
                    <td className="font-semibold text-ink whitespace-nowrap">
                      {to12h(r.visitTime || r.time)}
                    </td>
                    <td className="font-medium text-ink">
                      {r.name}
                    </td>
                    <td className="text-muted">
                      {r.phone}
                    </td>
                    {isSuperAdmin && !branchId && (
                      <td className="text-muted">
                        {(typeof r.branch === "object" && r.branch?.name) || "—"}
                      </td>
                    )}
                    <td>
                      {r.customer ? (
                        <div>
                          <span className="badge-success">
                            Existing: {r.customer.name}
                          </span>
                          {r.latestOrder && (
                            <p className="text-xs text-faint mt-1">
                              {r.latestOrder.suitNo
                                ? `Suit No ${r.latestOrder.suitNo}`
                                : r.latestOrder.orderNumber}{" "}
                              · {r.latestOrder.status?.replace(/_/g, " ")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="badge-accent">
                          New customer
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={STATUS_BADGE[r.status]}>
                        {r.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      {r.status === "booked" && (
                        <>
                          {hasFeature(user, "appointmentLoop") && (
                            <>
                              {/* Booking -> order in two taps: New Order opens
                                  with this phone already looked up. */}
                              <Link
                                href={`/orders/new?phone=${encodeURIComponent(r.phone)}`}
                                className="text-xs text-accent font-semibold hover:underline"
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
                                className="inline-flex items-center gap-1 ml-3 text-xs text-accent hover:underline"
                              >
                                <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                Remind
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => setStatus(r, "completed")}
                            className={`text-xs text-success hover:underline ${
                              hasFeature(user, "appointmentLoop") ? "ml-3" : ""
                            }`}
                          >
                            Complete
                          </button>
                          <button
                            onClick={() => setStatus(r, "cancelled")}
                            className="ml-3 text-xs text-danger hover:underline"
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

      <p className="text-xs text-faint">
        Booking hours, slots per hour, and the on/off switch are on the
        Settings page.
      </p>
    </div>
  );
}
