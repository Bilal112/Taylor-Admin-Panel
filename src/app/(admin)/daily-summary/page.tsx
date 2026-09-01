"use client";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/types/user";

// Daily closing summary (feature flag `dailySummary`) — what the admin
// reconciles the cash drawer against at the end of the day. The Print
// button uses the global print CSS (app chrome is hidden automatically).
interface Summary {
  newOrders: { count: number; value: number };
  delivered: number;
  payments: { _id: string; amount: number; count: number }[];
  collectedTotal: number;
  appointments: { _id: string; count: number }[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
};

const day = (d: Date) => d.toLocaleDateString("en-CA");

export default function DailySummaryPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [date, setDate] = useState(() => day(new Date()));
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<Summary | null>(null);
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
      .get("/dashboard/daily-summary", {
        params: { date, ...(branchId ? { branch: branchId } : {}) },
      })
      .then(({ data }) => setData(data.data))
      .catch((err) => toast.error(errorMessage(err, "Failed to load summary")))
      .finally(() => setLoading(false));
  }, [date, branchId]);

  useEffect(load, [load]);

  const appointmentsBooked = (data?.appointments || []).reduce(
    (s, a) => s + a.count,
    0,
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Daily Summary
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input text-sm w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {isSuperAdmin && (
            <select
              className="input text-sm w-auto"
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
          )}
          <button onClick={() => window.print()} className="btn-primary text-sm">
            🖨 Print
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="hidden print:block text-lg font-bold">
            ✂️ Daily Summary — {new Date(`${date}T00:00:00`).toLocaleDateString()}
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["New Orders", String(data.newOrders.count)],
              ["Orders Value", `PKR ${(data.newOrders.value || 0).toLocaleString()}`],
              ["Delivered", String(data.delivered)],
              ["Cash Collected", `PKR ${data.collectedTotal.toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={label} className="card">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="card p-0 overflow-hidden">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              Payments Collected
            </h2>
            {data.payments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 dark:text-gray-500">
                No payments recorded this day.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {data.payments.map((p) => (
                    <tr
                      key={p._id}
                      className="border-t border-gray-100 dark:border-gray-800 first:border-t-0"
                    >
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                        {METHOD_LABELS[p._id] || p._id}
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                          {p.count} payment{p.count === 1 ? "" : "s"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                        PKR {p.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-gray-100">
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                      PKR {data.collectedTotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {appointmentsBooked > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              📅 {appointmentsBooked} appointment
              {appointmentsBooked === 1 ? "" : "s"} for this day (
              {(data.appointments || [])
                .map((a) => `${a.count} ${a._id}`)
                .join(", ")}
              )
            </p>
          )}
        </div>
      )}
    </div>
  );
}
